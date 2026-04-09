package main

import "time"

type Category struct {
	ID       string `json:"id"`
	QuizID   string `json:"quiz_id"`
	Text     string `json:"text"`
	Position int    `json:"position"`
}

// API request/response types

type CreateQuizRequest struct {
	Categories      []string `json:"categories"`
	Password        string   `json:"password,omitempty"`
	MaxParticipants int      `json:"max_participants,omitempty"`
}

type CreateQuizResponse struct {
	ID       string `json:"id"`
	ShareURL string `json:"share_url"`
}

type QuizInfoResponse struct {
	ID               string     `json:"id"`
	Categories       []Category `json:"categories"`
	MaxParticipants  int        `json:"max_participants"`
	ParticipantCount int        `json:"participant_count"`
	SubmittedCount   int        `json:"submitted_count"`
	HasPassword      bool       `json:"has_password"`
}

type JoinQuizRequest struct {
	Name     string `json:"name"`
	Password string `json:"password,omitempty"`
}

type JoinQuizResponse struct {
	ParticipantToken string `json:"participant_token"`
	ParticipantID    string `json:"participant_id"`
}

type ResponseItem struct {
	CategoryID string `json:"category_id"`
	Answer     string `json:"answer"`
}

type SubmitRequest struct {
	Responses []ResponseItem `json:"responses"`
}

type SubmitResult struct {
	Submitted    bool `json:"submitted"`
	AllSubmitted bool `json:"all_submitted"`
}

type QuizStatus struct {
	Submitted    int  `json:"submitted"`
	Total        int  `json:"total"`
	AllSubmitted bool `json:"all_submitted"`
}

type ParticipantAnswer struct {
	ParticipantName string `json:"participant_name"`
	Answer          string `json:"answer"`
}

type CategoryResult struct {
	CategoryID   string              `json:"category_id"`
	CategoryText string              `json:"category_text"`
	Answers      []ParticipantAnswer `json:"answers"`
}

type ResultsResponse struct {
	Categories []CategoryResult `json:"categories"`
}

type AdminQuizSummary struct {
	ID               string    `json:"id"`
	CreatedAt        time.Time `json:"created_at"`
	ExpiresAt        time.Time `json:"expires_at"`
	MaxParticipants  int       `json:"max_participants"`
	ParticipantCount int       `json:"participant_count"`
	SubmittedCount   int       `json:"submitted_count"`
	HasPassword      bool      `json:"has_password"`
}
