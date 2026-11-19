package domain

import (
	"encoding/json"
	"testing"
)

func TestDomainModels_Serialization(t *testing.T) {
	t.Run("Project", func(t *testing.T) {
		prj := Project{
			ID:        42,
			Name:      "Demo Architecture",
			Content:   `{"nodes":[]}`,
			CreatedAt: 1789000000,
			UpdatedAt: 1789000500,
		}

		data, err := json.Marshal(prj)
		if err != nil {
			t.Fatalf("Failed to marshal Project: %v", err)
		}

		var restored Project
		if err := json.Unmarshal(data, &restored); err != nil {
			t.Fatalf("Failed to unmarshal Project: %v", err)
		}

		if restored.ID != prj.ID || restored.Name != prj.Name || restored.Content != prj.Content {
			t.Errorf("Mismatch in Project: expected %+v, got %+v", prj, restored)
		}
	})

	t.Run("HistoryLog", func(t *testing.T) {
		log := HistoryLog{
			Index:      3,
			ActionName: "Scale Deployment",
			Timestamp:  1789001000,
		}

		data, err := json.Marshal(log)
		if err != nil {
			t.Fatalf("Failed to marshal HistoryLog: %v", err)
		}

		var restored HistoryLog
		if err := json.Unmarshal(data, &restored); err != nil {
			t.Fatalf("Failed to unmarshal HistoryLog: %v", err)
		}

		if restored.Index != log.Index || restored.ActionName != log.ActionName || restored.Timestamp != log.Timestamp {
			t.Errorf("Mismatch in HistoryLog: expected %+v, got %+v", log, restored)
		}
	})

	t.Run("AutosaveProfileItem", func(t *testing.T) {
		item := AutosaveProfileItem{
			Key:       "autosave-session-1",
			Timestamp: 1789000000,
			Location:  "~/.kube-simulator/autosaves/autosave-session-1.infra",
		}

		data, err := json.Marshal(item)
		if err != nil {
			t.Fatalf("Failed to marshal AutosaveProfileItem: %v", err)
		}

		var restored AutosaveProfileItem
		if err := json.Unmarshal(data, &restored); err != nil {
			t.Fatalf("Failed to unmarshal AutosaveProfileItem: %v", err)
		}

		if restored.Key != item.Key || restored.Timestamp != item.Timestamp || restored.Location != item.Location {
			t.Errorf("Mismatch in AutosaveProfileItem: expected %+v, got %+v", item, restored)
		}
	})

	t.Run("InternetProfile", func(t *testing.T) {
		p := InternetProfile{
			Name:      "Heavy-Traffic",
			Hourly:    map[string]int{"0": 100, "1": 250},
			Daily:     map[string]int{"1": 5000},
			Timestamp: 1789111111,
		}

		data, err := json.Marshal(p)
		if err != nil {
			t.Fatalf("Failed to marshal InternetProfile: %v", err)
		}

		var restored InternetProfile
		if err := json.Unmarshal(data, &restored); err != nil {
			t.Fatalf("Failed to unmarshal InternetProfile: %v", err)
		}

		if restored.Name != p.Name || restored.Hourly["0"] != 100 || restored.Daily["1"] != 5000 {
			t.Errorf("Mismatch in InternetProfile: expected %+v, got %+v", p, restored)
		}
	})

	t.Run("SystemInfo", func(t *testing.T) {
		info := SystemInfo{
			OS:        "linux",
			Arch:      "amd64",
			GoVersion: "go1.25.0",
			Version:   "1.2.3",
		}

		data, err := json.Marshal(info)
		if err != nil {
			t.Fatalf("Failed to marshal SystemInfo: %v", err)
		}

		var restored SystemInfo
		if err := json.Unmarshal(data, &restored); err != nil {
			t.Fatalf("Failed to unmarshal SystemInfo: %v", err)
		}

		if restored.OS != info.OS || restored.Version != info.Version {
			t.Errorf("Mismatch in SystemInfo: expected %+v, got %+v", info, restored)
		}
	})
}
