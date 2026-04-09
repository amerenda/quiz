package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

var db *pgxpool.Pool

func initDB(ctx context.Context) error {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://quiz:quiz@localhost:5432/quiz"
	}

	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return fmt.Errorf("parse db config: %w", err)
	}
	cfg.MinConns = 2
	cfg.MaxConns = 10

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return fmt.Errorf("create pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		return fmt.Errorf("ping db: %w", err)
	}

	db = pool
	return migrateDB(ctx)
}

func migrateDB(ctx context.Context) error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS quizzes (
			id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			password_hash    TEXT,
			max_participants INT NOT NULL DEFAULT 2,
			expires_at       TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
			created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS categories (
			id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			quiz_id  UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
			text     TEXT NOT NULL,
			position INT  NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS participants (
			id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			quiz_id      UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
			name         TEXT NOT NULL,
			submitted_at TIMESTAMPTZ,
			created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS responses (
			id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
			category_id    UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
			answer         TEXT NOT NULL CHECK (answer IN ('hard_no', 'soft_yes', 'emphatic_yes')),
			UNIQUE(participant_id, category_id)
		)`,
	}

	for _, stmt := range statements {
		if _, err := db.Exec(ctx, stmt); err != nil {
			return fmt.Errorf("migration failed: %w", err)
		}
	}

	log.Println("database migrations complete")
	return nil
}
