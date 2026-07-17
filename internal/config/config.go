package config

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// Config はアプリケーション設定
type Config struct {
	LastFolder string `json:"lastFolder"`
}

// GetConfigDir は設定ファイルの保存先ディレクトリの絶対パスを返す
func GetConfigDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".pumlv-gui"), nil
}

// Load は設定ファイルを読み込む
func Load() (*Config, error) {
	dir, err := GetConfigDir()
	if err != nil {
		return &Config{}, err
	}
	file := filepath.Join(dir, "config.json")
	data, err := os.ReadFile(file)
	if err != nil {
		// ファイルがないなどの場合はデフォルトを返す
		return &Config{}, nil
	}
	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return &Config{}, err
	}
	return &cfg, nil
}

// Save は設定ファイルを保存する
func (c *Config) Save() error {
	dir, err := GetConfigDir()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	file := filepath.Join(dir, "config.json")
	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(file, data, 0644)
}
