FROM oven/bun:1.1.38-alpine
WORKDIR /app
COPY package.json ./
RUN bun install --frozen-lockfile || bun install
COPY tsconfig.json ./
COPY src ./src
COPY test ./test
EXPOSE 3000
CMD ["bun", "src/index.ts"]
