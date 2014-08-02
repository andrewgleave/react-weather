package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"path"
)

const (
	googleGeocodeURL = "http://maps.google.com/maps/api/geocode/json"
	forecastURL      = "https://api.forecast.io/forecast/your-api-key-here/"
	rootAssetPath    = "/path/to/react-weather"
)

type Location struct {
	Lat float64
	Lng float64
}

type GeocodeResponse struct {
	Results []struct {
		FormattedAddress string `json:"formatted_address"`
		Geometry         struct {
			Location Location
		}
	}
}

type WeatherResponse struct {
	Address  string      `json:"formattedAddress"`
	Location Location    `json:"location"`
	Weather  interface{} `json:"data"`
}

func main() {
	http.HandleFunc("/", indexHandler)
	http.HandleFunc("/weather/", weatherHandler)
	http.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir(path.Join(rootAssetPath, "www/static")))))
	log.Fatal(http.ListenAndServe(":8080", nil))
}

func indexHandler(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, path.Join(rootAssetPath, "www/index.html"))
}

func weatherHandler(w http.ResponseWriter, r *http.Request) {
	if address, ok := r.URL.Query()["address"]; ok {
		address := address[0]
		result, err := geocode(address)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
		}
		geocoded := result.Results[0]
		loc := geocoded.Geometry.Location
		weather, err := loadWeather(loc)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
		}
		resp := &WeatherResponse{Address: geocoded.FormattedAddress, Location: loc, Weather: weather}
		enc := json.NewEncoder(w)
		if err := enc.Encode(&resp); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
		}
	} else {
		http.Error(w, http.StatusText(http.StatusNotFound), http.StatusNotFound)
	}
}

func geocode(address string) (res *GeocodeResponse, err error) {
	u, _ := url.Parse(googleGeocodeURL)
	q := url.Values{}
	q.Add("address", address)
	u.RawQuery = q.Encode()
	resp, err := http.Get(u.String())
	if err != nil {
		return nil, err
	}
	res = &GeocodeResponse{}
	if err := json.NewDecoder(resp.Body).Decode(res); err != nil {
		return nil, err
	}
	if len(res.Results) == 0 {
		return nil, errors.New("No Results")
	}
	return res, nil
}

func loadWeather(loc Location) (data interface{}, err error) {
	u := fmt.Sprintf("%s%f,%f", forecastURL, loc.Lat, loc.Lng)
	parsed, _ := url.Parse(u)
	q := url.Values{}
	q.Add("exclude", "minutely,daily")
	q.Add("units", "si")
	parsed.RawQuery = q.Encode()
	resp, err := http.Get(parsed.String())
	if err != nil {
		return nil, err
	}
	var res interface{}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return nil, err
	}
	return res, nil
}
