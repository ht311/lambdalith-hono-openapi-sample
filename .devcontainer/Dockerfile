FROM mcr.microsoft.com/devcontainers/base:ubuntu

# Node.js LTS via nodesource
RUN curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
