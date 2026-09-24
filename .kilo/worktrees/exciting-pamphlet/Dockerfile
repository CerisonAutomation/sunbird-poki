# Sunbird authoritative multiplayer server (rust/crates/sunbird-server).
#
#   docker build -t sunbird-multiplayer:latest .
#   docker run --rm -p 8080:8080 \
#     -e SUNBIRD_RECONNECT_HMAC_SECRET="$(openssl rand -hex 32)" \
#     sunbird-multiplayer:latest
#
# The binary is static-enough to run on a slim Debian base; no Rust
# toolchain is needed at runtime. See docker-compose.yml for the
# two-service self-hosted stack (multiplayer + social backend).

FROM rust:1.85-bookworm AS build
WORKDIR /build
# Copy the workspace first so dependency layers cache across builds.
COPY rust/Cargo.toml rust/Cargo.lock ./
COPY rust/crates/sunbird-protocol/Cargo.toml crates/sunbird-protocol/
COPY rust/crates/sunbird-server/Cargo.toml crates/sunbird-server/
RUN cargo fetch
COPY rust/ ./
RUN cargo build --release -p sunbird-server

FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /build/target/release/sunbird-server /usr/local/bin/sunbird-server

# 8080 = WS + HTTP API, 9090 = Prometheus metrics (when SUNBIRD_METRICS_BIND_ADDR is set).
EXPOSE 8080 9090
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD bash -c 'exec 3<>/dev/tcp/127.0.0.1/8080' || exit 1
ENTRYPOINT ["sunbird-server"]
