# Multi-stage build for Go Cluster Daemon
FROM golang:alpine AS builder

WORKDIR /app

RUN apk add --no-cache git gcc musl-dev

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN go mod tidy && CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o daemon main.go

# Production runtime container
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app
COPY --from=builder /app/daemon /app/daemon

ENV PORT=8080 \
    DATA_DIR=/data \
    CLUSTER_TOTAL_RAM_MB=12288 \
    K3S_NAMESPACE=default \
    CLUSTER_DOMAIN=cluster.local

RUN mkdir -p /data

EXPOSE 8080

ENTRYPOINT ["/app/daemon"]
