FROM alpine:3.20

RUN apk add --no-cache \
    postgresql16-client \
    openssl \
    rclone \
    bash \
    tzdata \
    ca-certificates \
    findutils \
    coreutils \
    curl

COPY backup.sh restore.sh verify_backup.sh entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/*.sh

ENV TZ=UTC
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
