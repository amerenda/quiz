package main

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"golang.org/x/crypto/bcrypt"
)

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

// POST /api/quizzes
func handleCreateQuiz(w http.ResponseWriter, r *http.Request) {
	var req CreateQuizRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.Categories) == 0 {
		http.Error(w, "categories required", http.StatusBadRequest)
		return
	}

	if req.MaxParticipants < 2 {
		req.MaxParticipants = 2
	}
	if req.MaxParticipants > 20 {
		req.MaxParticipants = 20
	}

	var passwordHash *string
	if req.Password != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			http.Error(w, "server error", http.StatusInternalServerError)
			return
		}
		s := string(hash)
		passwordHash = &s
	}

	ctx := r.Context()
	tx, err := db.Begin(ctx)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	var quizID string
	err = tx.QueryRow(ctx,
		`INSERT INTO quizzes (password_hash, max_participants) VALUES ($1, $2) RETURNING id`,
		passwordHash, req.MaxParticipants,
	).Scan(&quizID)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}

	for i, text := range req.Categories {
		text = strings.TrimSpace(text)
		if text == "" {
			continue
		}
		if _, err = tx.Exec(ctx,
			`INSERT INTO categories (quiz_id, text, position) VALUES ($1, $2, $3)`,
			quizID, text, i,
		); err != nil {
			http.Error(w, "server error", http.StatusInternalServerError)
			return
		}
	}

	if err := tx.Commit(ctx); err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusCreated, CreateQuizResponse{
		ID:       quizID,
		ShareURL: appOrigin + "/quiz/" + quizID,
	})
}

// GET /api/quizzes/:id
func handleGetQuiz(w http.ResponseWriter, r *http.Request) {
	quizID := chi.URLParam(r, "id")
	ctx := r.Context()

	var hasPassword bool
	var maxParticipants int
	err := db.QueryRow(ctx,
		`SELECT password_hash IS NOT NULL, max_participants FROM quizzes WHERE id = $1 AND expires_at > NOW()`,
		quizID,
	).Scan(&hasPassword, &maxParticipants)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

	rows, err := db.Query(ctx,
		`SELECT id, text, position FROM categories WHERE quiz_id = $1 ORDER BY position`,
		quizID,
	)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	categories := []Category{}
	for rows.Next() {
		var c Category
		if err := rows.Scan(&c.ID, &c.Text, &c.Position); err != nil {
			continue
		}
		c.QuizID = quizID
		categories = append(categories, c)
	}

	var participantCount, submittedCount int
	db.QueryRow(ctx, `SELECT COUNT(*) FROM participants WHERE quiz_id = $1`, quizID).Scan(&participantCount)
	db.QueryRow(ctx, `SELECT COUNT(*) FROM participants WHERE quiz_id = $1 AND submitted_at IS NOT NULL`, quizID).Scan(&submittedCount)

	writeJSON(w, http.StatusOK, QuizInfoResponse{
		ID:               quizID,
		Categories:       categories,
		MaxParticipants:  maxParticipants,
		ParticipantCount: participantCount,
		SubmittedCount:   submittedCount,
		HasPassword:      hasPassword,
	})
}

// POST /api/quizzes/:id/participants
func handleJoinQuiz(w http.ResponseWriter, r *http.Request) {
	quizID := chi.URLParam(r, "id")
	ctx := r.Context()

	var req JoinQuizRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Name) == "" {
		http.Error(w, "name required", http.StatusBadRequest)
		return
	}

	var passwordHash *string
	var maxParticipants int
	err := db.QueryRow(ctx,
		`SELECT password_hash, max_participants FROM quizzes WHERE id = $1 AND expires_at > NOW()`,
		quizID,
	).Scan(&passwordHash, &maxParticipants)
	if err != nil {
		http.Error(w, "quiz not found", http.StatusNotFound)
		return
	}

	if passwordHash != nil {
		if err := bcrypt.CompareHashAndPassword([]byte(*passwordHash), []byte(req.Password)); err != nil {
			http.Error(w, "invalid password", http.StatusForbidden)
			return
		}
	}

	var count int
	db.QueryRow(ctx, `SELECT COUNT(*) FROM participants WHERE quiz_id = $1`, quizID).Scan(&count)
	if count >= maxParticipants {
		http.Error(w, "quiz is full", http.StatusConflict)
		return
	}

	var participantID string
	err = db.QueryRow(ctx,
		`INSERT INTO participants (quiz_id, name) VALUES ($1, $2) RETURNING id`,
		quizID, strings.TrimSpace(req.Name),
	).Scan(&participantID)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}

	token, err := createParticipantToken(participantID, quizID)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusCreated, JoinQuizResponse{
		ParticipantToken: token,
		ParticipantID:    participantID,
	})
}

// POST /api/quizzes/:id/submit
func handleSubmitQuiz(w http.ResponseWriter, r *http.Request) {
	quizID := chi.URLParam(r, "id")
	ctx := r.Context()

	authHeader := r.Header.Get("Authorization")
	if !strings.HasPrefix(authHeader, "Bearer ") {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	participantID, tokenQuizID, err := validateParticipantToken(strings.TrimPrefix(authHeader, "Bearer "))
	if err != nil || tokenQuizID != quizID {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var submittedAt *time.Time
	err = db.QueryRow(ctx,
		`SELECT submitted_at FROM participants WHERE id = $1 AND quiz_id = $2`,
		participantID, quizID,
	).Scan(&submittedAt)
	if err != nil {
		http.Error(w, "participant not found", http.StatusNotFound)
		return
	}
	if submittedAt != nil {
		http.Error(w, "already submitted", http.StatusConflict)
		return
	}

	var req SubmitRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.Responses) == 0 {
		http.Error(w, "responses required", http.StatusBadRequest)
		return
	}

	var categoryCount int
	db.QueryRow(ctx, `SELECT COUNT(*) FROM categories WHERE quiz_id = $1`, quizID).Scan(&categoryCount)
	if len(req.Responses) != categoryCount {
		http.Error(w, "all categories must be answered", http.StatusBadRequest)
		return
	}

	tx, err := db.Begin(ctx)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	for _, resp := range req.Responses {
		if resp.Answer != "hard_no" && resp.Answer != "soft_yes" && resp.Answer != "emphatic_yes" {
			http.Error(w, "invalid answer value", http.StatusBadRequest)
			return
		}
		if _, err = tx.Exec(ctx,
			`INSERT INTO responses (participant_id, category_id, answer) VALUES ($1, $2, $3)
			 ON CONFLICT (participant_id, category_id) DO UPDATE SET answer = $3`,
			participantID, resp.CategoryID, resp.Answer,
		); err != nil {
			http.Error(w, "server error", http.StatusInternalServerError)
			return
		}
	}

	if _, err = tx.Exec(ctx,
		`UPDATE participants SET submitted_at = NOW() WHERE id = $1`, participantID,
	); err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(ctx); err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}

	var maxParticipants, submittedCount int
	db.QueryRow(ctx, `SELECT max_participants FROM quizzes WHERE id = $1`, quizID).Scan(&maxParticipants)
	db.QueryRow(ctx, `SELECT COUNT(*) FROM participants WHERE quiz_id = $1 AND submitted_at IS NOT NULL`, quizID).Scan(&submittedCount)

	writeJSON(w, http.StatusOK, SubmitResult{
		Submitted:    true,
		AllSubmitted: submittedCount >= maxParticipants,
	})
}

// GET /api/quizzes/:id/status
func handleQuizStatus(w http.ResponseWriter, r *http.Request) {
	quizID := chi.URLParam(r, "id")
	ctx := r.Context()

	var maxParticipants int
	err := db.QueryRow(ctx,
		`SELECT max_participants FROM quizzes WHERE id = $1 AND expires_at > NOW()`,
		quizID,
	).Scan(&maxParticipants)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

	var submittedCount int
	db.QueryRow(ctx, `SELECT COUNT(*) FROM participants WHERE quiz_id = $1 AND submitted_at IS NOT NULL`, quizID).Scan(&submittedCount)

	writeJSON(w, http.StatusOK, QuizStatus{
		Submitted:    submittedCount,
		Total:        maxParticipants,
		AllSubmitted: submittedCount >= maxParticipants,
	})
}

// GET /api/quizzes/:id/results
func handleGetResults(w http.ResponseWriter, r *http.Request) {
	quizID := chi.URLParam(r, "id")
	ctx := r.Context()

	var maxParticipants int
	err := db.QueryRow(ctx,
		`SELECT max_participants FROM quizzes WHERE id = $1 AND expires_at > NOW()`,
		quizID,
	).Scan(&maxParticipants)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

	var submittedCount int
	db.QueryRow(ctx, `SELECT COUNT(*) FROM participants WHERE quiz_id = $1 AND submitted_at IS NOT NULL`, quizID).Scan(&submittedCount)
	if submittedCount < maxParticipants {
		http.Error(w, "results not ready", http.StatusNotFound)
		return
	}

	rows, err := db.Query(ctx, `
		SELECT c.id, c.text, p.name, res.answer
		FROM categories c
		JOIN responses res ON res.category_id = c.id
		JOIN participants p ON p.id = res.participant_id
		WHERE c.quiz_id = $1 AND p.submitted_at IS NOT NULL
		ORDER BY c.position, p.created_at
	`, quizID)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	catMap := map[string]*CategoryResult{}
	catOrder := []string{}

	for rows.Next() {
		var catID, catText, participantName, answer string
		if err := rows.Scan(&catID, &catText, &participantName, &answer); err != nil {
			continue
		}
		if _, exists := catMap[catID]; !exists {
			catMap[catID] = &CategoryResult{
				CategoryID:   catID,
				CategoryText: catText,
				Answers:      []ParticipantAnswer{},
			}
			catOrder = append(catOrder, catID)
		}
		catMap[catID].Answers = append(catMap[catID].Answers, ParticipantAnswer{
			ParticipantName: participantName,
			Answer:          answer,
		})
	}

	// Only show categories where every participant answered yes (soft or emphatic)
	matched := []CategoryResult{}
	for _, catID := range catOrder {
		cat := catMap[catID]
		allYes := true
		for _, a := range cat.Answers {
			if a.Answer == "hard_no" {
				allYes = false
				break
			}
		}
		if allYes && len(cat.Answers) == maxParticipants {
			matched = append(matched, *cat)
		}
	}

	writeJSON(w, http.StatusOK, ResultsResponse{Categories: matched})
}

// GET /api/admin/quizzes
func handleAdminListQuizzes(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	rows, err := db.Query(ctx, `
		SELECT
			q.id, q.created_at, q.expires_at, q.max_participants,
			q.password_hash IS NOT NULL,
			COUNT(DISTINCT p.id),
			COUNT(DISTINCT CASE WHEN p.submitted_at IS NOT NULL THEN p.id END)
		FROM quizzes q
		LEFT JOIN participants p ON p.quiz_id = q.id
		GROUP BY q.id
		ORDER BY q.created_at DESC
		LIMIT 200
	`)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	quizzes := []AdminQuizSummary{}
	for rows.Next() {
		var q AdminQuizSummary
		if err := rows.Scan(&q.ID, &q.CreatedAt, &q.ExpiresAt, &q.MaxParticipants,
			&q.HasPassword, &q.ParticipantCount, &q.SubmittedCount); err != nil {
			continue
		}
		quizzes = append(quizzes, q)
	}

	writeJSON(w, http.StatusOK, quizzes)
}

// DELETE /api/admin/quizzes/:id
func handleAdminDeleteQuiz(w http.ResponseWriter, r *http.Request) {
	quizID := chi.URLParam(r, "id")
	ctx := r.Context()

	result, err := db.Exec(ctx, `DELETE FROM quizzes WHERE id = $1`, quizID)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	if result.RowsAffected() == 0 {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"deleted": true})
}
