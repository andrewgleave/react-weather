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
	log.Fatal(http.ListenAndServe(":3000", nil))
}

func indexHandler(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, path.Join(rootAssetPath, "www/index.html"))
}

func weatherHandler(w http.ResponseWriter, r *http.Request) {
	if address, ok := r.URL.Query()["address"]; ok {
		address := address[0]
		geo := &GeocodeResponse{}
		if err := geocodeAddress(address, geo); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
		}
		location := geo.Results[0].Geometry.Location
		var weather interface{}
		if err := loadWeather(location, &weather); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
		}
		resp := &WeatherResponse{Address: geo.Results[0].FormattedAddress, Location: location, Weather: weather}
		if err := json.NewEncoder(w).Encode(&resp); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
		}
	} else {
		http.Error(w, http.StatusText(http.StatusNotFound), http.StatusNotFound)
	}
}

func geocodeAddress(address string, res *GeocodeResponse) (err error) {
	u, _ := url.Parse(googleGeocodeURL)
	q := url.Values{}
	q.Add("address", address)
	u.RawQuery = q.Encode()
	resp, err := http.Get(u.String())
	if err != nil {
		return err
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return err
	}
	if len(res.Results) == 0 {
		return errors.New("No Results")
	}
	return nil
}

func loadWeather(loc Location, res *interface{}) (err error) {
	u := fmt.Sprintf("%s%f,%f", forecastURL, loc.Lat, loc.Lng)
	parsed, _ := url.Parse(u)
	q := url.Values{}
	q.Add("exclude", "minutely,daily")
	q.Add("units", "si")
	parsed.RawQuery = q.Encode()
	resp, err := http.Get(parsed.String())
	if err != nil {
		return err
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return err
	}
	return nil
}
