package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var (
	sessionSecret      []byte
	allowedUsers       []string
	githubClientID     string
	githubClientSecret string
	appOrigin          string
)

type contextKey string

const contextKeyUsername contextKey = "username"

func initAuth() {
	sessionSecret = []byte(strings.TrimSpace(os.Getenv("SESSION_SECRET")))
	if len(sessionSecret) == 0 {
		panic("SESSION_SECRET is required")
	}
	githubClientID = strings.TrimSpace(os.Getenv("GITHUB_CLIENT_ID"))
	githubClientSecret = strings.TrimSpace(os.Getenv("GITHUB_CLIENT_SECRET"))
	appOrigin = strings.TrimSpace(os.Getenv("APP_ORIGIN"))
	if appOrigin == "" {
		appOrigin = "https://quiz.amer.dev"
	}
	for _, u := range strings.Split(os.Getenv("GITHUB_ALLOWED_USERS"), ",") {
		u = strings.TrimSpace(u)
		if u != "" {
			allowedUsers = append(allowedUsers, u)
		}
	}
}

// Admin session JWT

type adminClaims struct {
	Username string `json:"username"`
	jwt.RegisteredClaims
}

func createAdminToken(username string) (string, error) {
	claims := adminClaims{
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(sessionSecret)
}

func validateAdminToken(tokenStr string) (string, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &adminClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return sessionSecret, nil
	})
	if err != nil {
		return "", err
	}
	claims, ok := token.Claims.(*adminClaims)
	if !ok || !token.Valid {
		return "", fmt.Errorf("invalid token")
	}
	return claims.Username, nil
}

func adminMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("quiz_session")
		if err != nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		username, err := validateAdminToken(cookie.Value)
		if err != nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		ctx := context.WithValue(r.Context(), contextKeyUsername, username)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// Participant JWT (stateless identity for quiz respondents)

func createParticipantToken(participantID, quizID string) (string, error) {
	claims := jwt.MapClaims{
		"participant_id": participantID,
		"quiz_id":        quizID,
		"exp":            time.Now().Add(30 * 24 * time.Hour).Unix(),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(sessionSecret)
}

func validateParticipantToken(tokenStr string) (participantID, quizID string, err error) {
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return sessionSecret, nil
	})
	if err != nil {
		return "", "", err
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return "", "", fmt.Errorf("invalid token")
	}
	participantID, _ = claims["participant_id"].(string)
	quizID, _ = claims["quiz_id"].(string)
	return participantID, quizID, nil
}

// GitHub OAuth handlers

func handleAuthLogin(w http.ResponseWriter, r *http.Request) {
	url := fmt.Sprintf(
		"https://github.com/login/oauth/authorize?client_id=%s&scope=read:user",
		githubClientID,
	)
	http.Redirect(w, r, url, http.StatusTemporaryRedirect)
}

func handleAuthCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	if code == "" {
		http.Error(w, "missing code", http.StatusBadRequest)
		return
	}

	req, _ := http.NewRequestWithContext(r.Context(), http.MethodPost,
		"https://github.com/login/oauth/access_token", nil)
	q := req.URL.Query()
	q.Set("client_id", githubClientID)
	q.Set("client_secret", githubClientSecret)
	q.Set("code", code)
	req.URL.RawQuery = q.Encode()
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		http.Error(w, "oauth error", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	var tokenResp struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil || tokenResp.AccessToken == "" {
		http.Error(w, "failed to get access token", http.StatusInternalServerError)
		return
	}

	userReq, _ := http.NewRequestWithContext(r.Context(), http.MethodGet,
		"https://api.github.com/user", nil)
	userReq.Header.Set("Authorization", "Bearer "+tokenResp.AccessToken)
	userReq.Header.Set("Accept", "application/json")

	userResp, err := http.DefaultClient.Do(userReq)
	if err != nil {
		http.Error(w, "failed to get user", http.StatusInternalServerError)
		return
	}
	defer userResp.Body.Close()

	var ghUser struct {
		Login string `json:"login"`
	}
	if err := json.NewDecoder(userResp.Body).Decode(&ghUser); err != nil {
		http.Error(w, "failed to parse user", http.StatusInternalServerError)
		return
	}

	allowed := false
	for _, u := range allowedUsers {
		if strings.EqualFold(u, ghUser.Login) {
			allowed = true
			break
		}
	}
	if !allowed {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	sessionToken, err := createAdminToken(ghUser.Login)
	if err != nil {
		http.Error(w, "session error", http.StatusInternalServerError)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "quiz_session",
		Value:    sessionToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   7 * 24 * 3600,
	})

	http.Redirect(w, r, appOrigin+"/admin", http.StatusTemporaryRedirect)
}

func handleAuthMe(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("quiz_session")
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"authenticated": false})
		return
	}
	username, err := validateAdminToken(cookie.Value)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"authenticated": false})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"authenticated": true, "username": username})
}

func handleAuthLogout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     "quiz_session",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		MaxAge:   -1,
	})
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}
