package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func main() {
	ctx := context.Background()

	initAuth()

	if err := initDB(ctx); err != nil {
		log.Fatalf("database init failed: %v", err)
	}
	defer db.Close()

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))

	if os.Getenv("ENVIRONMENT") == "development" {
		r.Use(func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Access-Control-Allow-Origin", "http://localhost:5173")
				w.Header().Set("Access-Control-Allow-Credentials", "true")
				w.Header().Set("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type,Authorization")
				if r.Method == http.MethodOptions {
					w.WriteHeader(http.StatusNoContent)
					return
				}
				next.ServeHTTP(w, r)
			})
		})
	}

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	r.Get("/auth/login", handleAuthLogin)
	r.Get("/auth/callback", handleAuthCallback)
	r.Get("/auth/me", handleAuthMe)
	r.Post("/auth/logout", handleAuthLogout)

	r.Route("/api/quizzes", func(r chi.Router) {
		r.Post("/", handleCreateQuiz)
		r.Get("/{id}", handleGetQuiz)
		r.Post("/{id}/participants", handleJoinQuiz)
		r.Post("/{id}/submit", handleSubmitQuiz)
		r.Get("/{id}/status", handleQuizStatus)
		r.Get("/{id}/results", handleGetResults)
	})

	r.Route("/api/admin", func(r chi.Router) {
		r.Use(adminMiddleware)
		r.Get("/quizzes", handleAdminListQuizzes)
		r.Delete("/quizzes/{id}", handleAdminDeleteQuiz)
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	log.Printf("quiz backend listening on :%s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
