FROM golang:1.23-alpine AS builder

WORKDIR /app

COPY backend/ .
RUN go mod tidy && CGO_ENABLED=0 GOOS=linux go build -o quiz-backend .

FROM alpine:3.21
RUN adduser -D -u 1000 quiz
WORKDIR /app
COPY --from=builder /app/quiz-backend .
RUN chown quiz:quiz /app/quiz-backend
USER quiz
EXPOSE 8081
CMD ["./quiz-backend"]
