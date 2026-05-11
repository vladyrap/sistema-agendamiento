FROM alpine:3.20

RUN apk add --no-cache \
    postgresql16-client \
    openssl \
    rclone \
    bash \
    tzdata \
    ca-certificates \
    findutils \
    coreutils

COPY backup.sh restore.sh entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/*.sh

ENV TZ=UTC
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
