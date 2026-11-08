package crypto

import (
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/ethereum/go-ethereum/crypto"
)

// PrefixedPersonalSignHash calculates the standard Ethereum personal_sign Keccak256 hash
func PrefixedPersonalSignHash(msg []byte) []byte {
	prefix := []byte("\x19Ethereum Signed Message:\n" + strconv.Itoa(len(msg)))
	data := append(prefix, msg...)
	return crypto.Keccak256(data)
}

// CanonicalJSON marshals an interface into a sorted, deterministic JSON string
func CanonicalJSON(v interface{}) ([]byte, error) {
	return json.Marshal(v)
}

// RecoverSignerAddress reverses the cryptographic signature (ecrecover) to retrieve the Public Key
// and calculates the corresponding Ethereum wallet address.
func RecoverSignerAddress(message []byte, signatureHex string) (string, error) {
	cleanSig := strings.TrimPrefix(signatureHex, "0x")
	sigBytes, err := hex.DecodeString(cleanSig)
	if err != nil {
		return "", fmt.Errorf("invalid hex signature: %w", err)
	}

	if len(sigBytes) != 65 {
		return "", fmt.Errorf("invalid signature length: expected 65 bytes, got %d", len(sigBytes))
	}

	// Adjust V value for secp256k1 recovery (27/28 -> 0/1)
	if sigBytes[64] >= 27 {
		sigBytes[64] -= 27
	}

	// Calculate personal_sign hash
	msgHash := PrefixedPersonalSignHash(message)

	// ecrecover: Recover the public key from the signature and hash
	pubKey, err := crypto.SigToPub(msgHash, sigBytes)
	if err != nil {
		// Fallback: try raw Keccak256 hash if client signed without personal prefix
		rawHash := crypto.Keccak256(message)
		pubKeyFallback, errFallback := crypto.SigToPub(rawHash, sigBytes)
		if errFallback != nil {
			return "", fmt.Errorf("cryptographic ecrecover failed: %w", err)
		}
		pubKey = pubKeyFallback
	}

	// Derive the user's Ethereum address from the public key
	recoveredAddr := crypto.PubkeyToAddress(*pubKey).Hex()
	return strings.ToLower(recoveredAddr), nil
}

// VerifyEthereumSignature validates that the provided signature was created by expectedAddress for message.
func VerifyEthereumSignature(message []byte, signatureHex string, expectedAddress string) (bool, string, error) {
	if signatureHex == "" {
		return false, "", errors.New("signature is required")
	}
	if expectedAddress == "" {
		return false, "", errors.New("expected signer address is required")
	}

	recoveredAddr, err := RecoverSignerAddress(message, signatureHex)
	if err != nil {
		return false, "", err
	}

	expectedClean := strings.ToLower(strings.TrimSpace(expectedAddress))
	if recoveredAddr != expectedClean {
		return false, recoveredAddr, fmt.Errorf("signature verification failed: recovered address %s does not match expected %s", recoveredAddr, expectedClean)
	}

	return true, recoveredAddr, nil
}
