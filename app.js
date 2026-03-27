document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const elements = {
        rateInput: document.getElementById('exchangeRate'),
        rateStatus: document.getElementById('rateStatus'),
        sgFuelType: document.getElementById('sgFuelType'),
        myFuelType: document.getElementById('myFuelType'),
        sgPumpPrice: document.getElementById('sgPumpPrice'),
        myPumpPrice: document.getElementById('myPumpPrice'),
        sgFuelStatus: document.getElementById('sgFuelStatus'),
        myFuelStatus: document.getElementById('myFuelStatus'),
        fuelToPump: document.getElementById('fuelToPump'),
        fuelEconomy: document.getElementById('fuelEconomy'),
        postalCode: document.getElementById('postalCode'),
        getLocationBtn: document.getElementById('getLocationBtn'),
        locationStatus: document.getElementById('locationStatus'),
        calculatedDistanceLabel: document.getElementById('calculatedDistanceLabel'),
        checkpoint: document.getElementById('checkpoint'),
        checkpointTollsInfo: document.getElementById('checkpointTollsInfo'),
        calcBtn: document.getElementById('calculateBtn'),
        resultsPanel: document.getElementById('resultsPanel'),
        calculatedTimeLabel: document.getElementById('calculatedTimeLabel'),
        map: document.getElementById('map')
    };

    // Store fetched prices
    const prices = {
        sg: { '92': 3.43, '95': 3.47, '98': 3.97, 'premium': 4.16, 'diesel': 3.93 },
        my: { 'ron_95_budi': 1.99, 'ron_95': 3.87, 'ron_97': 5.15, 'ron_100': 7.50, 'v_power_racing': 7.88, 'diesel_euro_5_b10': 5.52, 'diesel_euro_5_b10_east': 2.15, 'diesel_euro_5_b7': 4.92, 'diesel_euro_5_b7_east': 2.35 }
    };

    let calculatedReturnDistanceKm = 0;

    // Checkpoint Coordinates (SG side for OSRM start-leg routing)
    const checkpoints = {
        woodlands: { lat: 1.446, lng: 103.768 },
        tuas: { lat: 1.348, lng: 103.636 }
    };

    // JB-side coordinates for searching petrol stations (Malaysia side of each crossing)
    const jbSearchPoints = {
        woodlands: { lat: 1.4713, lng: 103.7623 }, // Near Sultan Iskandar CIQ
        tuas: { lat: 1.4243, lng: 103.5857 }        // Near Tanjung Kupang / KSAB
    };

    const updatePriceDisplay = () => {
        const sgVal = elements.sgFuelType.value;
        const myVal = elements.myFuelType.value;
        if (prices.sg[sgVal]) elements.sgPumpPrice.value = prices.sg[sgVal].toFixed(2);
        if (prices.my[myVal]) elements.myPumpPrice.value = prices.my[myVal].toFixed(2);
    };

    elements.sgFuelType.addEventListener('change', updatePriceDisplay);
    elements.myFuelType.addEventListener('change', updatePriceDisplay);

    // 1. Fetch Exchange Rate (CDN)
    const fetchExchangeRate = async () => {
        try {
            elements.rateStatus.textContent = 'Fetching...';
            const response = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/sgd.json');
            if (response.ok) {
                const data = await response.json();
                const rate = data.sgd.myr;
                elements.rateInput.value = rate.toFixed(4);
                elements.rateStatus.textContent = 'Live Data';
                elements.rateStatus.style.color = 'var(--success)';
            } else {
                throw new Error('Failed to fetch rate');
            }
        } catch (error) {
            console.error('Error fetching exchange rate:', error);
            elements.rateStatus.textContent = 'Failed (Using Default)';
            elements.rateStatus.style.color = 'var(--danger)';
            if (!elements.rateInput.value || elements.rateInput.value === "0.00") {
                elements.rateInput.value = '3.45';
            }
        }
    };

    // 2. Fetch SG & MY Fuel Prices from Node Backend Proxy
    const fetchFuelPrices = async () => {
        try {
            elements.sgFuelStatus.textContent = 'Fetching...';
            elements.myFuelStatus.textContent = 'Fetching...';
            const res = await fetch('/api/fuel-prices');
            if (!res.ok) throw new Error('Local backend proxy failed');
            const data = await res.json();

            if (data.sg) {
                Object.keys(data.sg).forEach(k => {
                    prices.sg[k] = data.sg[k];
                });
                elements.sgFuelStatus.textContent = 'Live Data';
                elements.sgFuelStatus.style.color = 'var(--success)';
            }
            if (data.my) {
                Object.keys(data.my).forEach(k => {
                    prices.my[k] = data.my[k];
                });
                elements.myFuelStatus.textContent = 'Live Data';
                elements.myFuelStatus.style.color = 'var(--success)';
            }
            updatePriceDisplay();
        } catch (error) {
            console.error('Fuel Proxy Fetch error:', error);
            elements.sgFuelStatus.textContent = 'Failed (Using Default)';
            elements.sgFuelStatus.style.color = 'var(--danger)';
            elements.myFuelStatus.textContent = 'Failed (Using Default)';
            elements.myFuelStatus.style.color = 'var(--danger)';
            updatePriceDisplay();
        }
    };

    let mapInstance = null;
    let routeLayer = null;

    const initMap = () => {
        if (!mapInstance) {
            mapInstance = L.map('map').setView([1.3521, 103.8198], 10);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap & CartoDB'
            }).addTo(mapInstance);
        }
    };

    // Shared Haversine distance helper (km)
    const haversineDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    let destinationMarker = null;
    let startMarker = null;

    // 3. OSRM Distance calculation API
    const computeAndSetDistance = async (lat, lng) => {
        const cp = elements.checkpoint.value;
        const cpCoords = checkpoints[cp];
        try {
            elements.locationStatus.style.display = 'inline-block';
            elements.locationStatus.textContent = 'Routing...';
            elements.locationStatus.style.color = 'var(--primary)';

            // Find nearest petrol station on JB side via Overpass API
            const jbPoint = jbSearchPoints[cp];
            let targetLat = jbPoint.lat;
            let targetLng = jbPoint.lng;
            let stationName = 'Nearest Petrol Station';
            try {
                const overpassQuery = `[out:json];node(around:5000,${jbPoint.lat},${jbPoint.lng})["amenity"="fuel"];out;`;
                const overpassRes = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`);
                const overpassData = await overpassRes.json();
                if (overpassData?.elements?.length > 0) {
                    let closest = null;
                    let minDist = Infinity;
                    for (const el of overpassData.elements) {
                        const dist = haversineDistance(cpCoords.lat, cpCoords.lng, el.lat, el.lon);
                        if (dist < minDist) {
                            minDist = dist;
                            closest = el;
                        }
                    }
                    if (closest) {
                        targetLat = closest.lat;
                        targetLng = closest.lon;
                        stationName = closest.tags?.name || closest.tags?.brand || 'Petrol Station';
                    }
                }
            } catch (err) {
                console.warn('Overpass API failed, using checkpoint coords:', err);
            }

            const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${lng},${lat};${targetLng},${targetLat}?overview=full&geometries=geojson`);
            const data = await res.json();
            if (data && data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                const drivingMeters = route.distance;
                const durationSeconds = route.duration;
                const singleWayKm = drivingMeters / 1000;
                calculatedReturnDistanceKm = singleWayKm * 2;
                elements.calculatedDistanceLabel.textContent = `Distance to go: ~${Math.round(calculatedReturnDistanceKm)} km`;

                // Show Time
                const mins = Math.round(durationSeconds / 60);
                elements.calculatedTimeLabel.textContent = `Est. Travel Time (1-way): ~${mins} mins`;
                elements.calculatedTimeLabel.style.display = 'block';

                elements.locationStatus.style.display = 'inline-block';
                elements.locationStatus.textContent = 'Found';
                elements.locationStatus.style.color = 'var(--success)';

                // Update Map
                elements.map.style.display = 'block';
                initMap();
                // small delay to ensure container dims are computed before resizing
                setTimeout(() => {
                    mapInstance.invalidateSize();
                    if (routeLayer) mapInstance.removeLayer(routeLayer);
                    routeLayer = L.geoJSON(route.geometry, {
                        style: { color: '#bc8cff', weight: 4, opacity: 0.85 }
                    }).addTo(mapInstance);

                    // Drop a pin on the starting location
                    if (startMarker) mapInstance.removeLayer(startMarker);
                    startMarker = L.marker([lat, lng], {
                        title: 'Your Location',
                        icon: L.divIcon({
                            html: '<span style="font-size: 28px;">📍</span>',
                            iconSize: [28, 28],
                            iconAnchor: [14, 28],
                            popupAnchor: [0, -28],
                            className: ''
                        })
                    }).addTo(mapInstance)
                      .bindPopup('📍 Your Start Location');

                    // Drop a pin on the destination petrol station
                    if (destinationMarker) mapInstance.removeLayer(destinationMarker);
                    destinationMarker = L.marker([targetLat, targetLng], {
                        title: 'Nearest Petrol Station',
                        icon: L.divIcon({
                            html: '<span style="font-size: 28px;">⛽</span>',
                            iconSize: [28, 28],
                            iconAnchor: [14, 28],
                            popupAnchor: [0, -28],
                            className: ''
                        })
                    }).addTo(mapInstance)
                      .bindPopup(`⛽ ${stationName}`).openPopup();

                    mapInstance.fitBounds(routeLayer.getBounds(), { padding: [20, 20] });
                }, 100);

            } else {
                throw new Error("Route not found");
            }
        } catch (error) {
            console.error('OSRM error:', error);
            elements.locationStatus.textContent = 'Routing Err';
            elements.locationStatus.style.color = 'var(--danger)';

            // Straight-line fallback with rough padding
            const singleWayKm = (haversineDistance(lat, lng, cpCoords.lat, cpCoords.lng) * 1.3) + 3;
            calculatedReturnDistanceKm = singleWayKm * 2;
            elements.calculatedDistanceLabel.textContent = `Distance to go: ~${Math.round(calculatedReturnDistanceKm)} km`;
        }
    };

    // Location Event Handlers
    elements.getLocationBtn.addEventListener('click', () => {
        elements.locationStatus.style.display = 'inline-block';
        elements.locationStatus.textContent = 'Locating...';
        elements.locationStatus.style.color = 'var(--primary)';
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition((position) => {
                computeAndSetDistance(position.coords.latitude, position.coords.longitude);
            }, (error) => {
                console.error('Geolocation error:', error);
                elements.locationStatus.textContent = 'Denied';
                elements.locationStatus.style.color = 'var(--danger)';
                // Fallback default distance
                calculatedReturnDistanceKm = 60;
                elements.calculatedDistanceLabel.textContent = `Distance to go: 60 km (Default)`;
            });
        }
    });

    elements.postalCode.addEventListener('input', async (e) => {
        const val = e.target.value.trim();
        if (val.length === 6 && /^\d+$/.test(val)) {
            elements.locationStatus.style.display = 'inline-block';
            elements.locationStatus.textContent = 'Searching...';
            elements.locationStatus.style.color = 'var(--primary)';
            try {
                const res = await fetch(`https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${val}&returnGeom=Y&getAddrDetails=N&pageNum=1`);
                const data = await res.json();
                if (data && data.results && data.results.length > 0) {
                    const lat = parseFloat(data.results[0].LATITUDE);
                    const lng = parseFloat(data.results[0].LONGITUDE);
                    computeAndSetDistance(lat, lng);
                } else {
                    throw new Error("Not found");
                }
            } catch (error) {
                elements.locationStatus.textContent = 'Not Found';
                elements.locationStatus.style.color = 'var(--danger)';
            }
        }
    });

    const updateCheckpointTolls = () => {
        const route = elements.checkpoint.value;
        if (route === 'woodlands') {
            elements.checkpointTollsInfo.textContent = "SG Toll: $0.80 | MY Toll: RM 4.74";
        } else if (route === 'tuas') {
            elements.checkpointTollsInfo.textContent = "SG Toll: $4.20 | MY Toll: RM 12.28";
        }
    };

    elements.checkpoint.addEventListener('change', () => {
        updateCheckpointTolls();
        if (elements.postalCode.value.length === 6) {
            elements.postalCode.dispatchEvent(new Event('input'));
        }
    });

    // Init Data Fetches
    updateCheckpointTolls();
    fetchExchangeRate();
    fetchFuelPrices();

    // 4. Calculation Engine
    elements.calcBtn.addEventListener('click', () => {
        // Validation check for distance fallback if user didn't enter postcode
        let finalDistance = calculatedReturnDistanceKm;
        if (finalDistance === 0) {
            elements.calculatedDistanceLabel.textContent = `Using default: 60 km`;
            finalDistance = 60;
        }

        const exchangeRate = parseFloat(elements.rateInput.value) || 3.45;
        const sgPumpPrice = parseFloat(elements.sgPumpPrice.value) || prices.sg[elements.sgFuelType.value];
        const myPumpPriceRM = parseFloat(elements.myPumpPrice.value) || prices.my[elements.myFuelType.value];
        const myPumpPriceSGD = myPumpPriceRM / exchangeRate;

        const litersToPump = parseFloat(elements.fuelToPump.value) || 0;
        const economyKmPerL = parseFloat(elements.fuelEconomy.value) || 12;
        const route = elements.checkpoint.value;

        // 1. Costs if stayed in SG
        const totalSGCost = litersToPump * sgPumpPrice;

        // 2. Journey Cost
        const fuelBurnedLiters = finalDistance / economyKmPerL;
        const journeyCostSgd = fuelBurnedLiters * sgPumpPrice;

        // 3. Cost to pump in JB
        const jbFuelCostSgd = litersToPump * myPumpPriceSGD;

        // 4. Tolls
        let sgToll = 0, myTollRm = 0, myRoadChargeRm = 20.00;
        if (route === 'woodlands') {
            sgToll = 0.80;
            myTollRm = 4.74;
        } else if (route === 'tuas') {
            sgToll = 4.20;
            myTollRm = 12.28;
        }
        const tollsSgd = sgToll + ((myTollRm + myRoadChargeRm) / exchangeRate);

        // Subtotals
        const totalJBCostSgd = jbFuelCostSgd + journeyCostSgd + tollsSgd;
        const financialSavingsSgd = totalSGCost - totalJBCostSgd;

        // Update UI Outputs
        document.getElementById('resSGCost').textContent = `$${totalSGCost.toFixed(2)}`;
        document.getElementById('resJBCost').textContent = `$${jbFuelCostSgd.toFixed(2)}`;
        document.getElementById('resTravelCost').textContent = `$${journeyCostSgd.toFixed(2)}`;
        document.getElementById('resTolls').textContent = `$${tollsSgd.toFixed(2)}`;
        document.getElementById('resTotalJbCost').textContent = `$${totalJBCostSgd.toFixed(2)}`;

        const elFinNet = document.getElementById('resFinancialNet');
        elFinNet.textContent = `${financialSavingsSgd >= 0 ? '+' : ''}$${financialSavingsSgd.toFixed(2)}`;
        elFinNet.className = `val-right ${financialSavingsSgd >= 0 ? 'final-net' : 'negative'}`;
        elFinNet.style.color = financialSavingsSgd >= 0 ? 'var(--success)' : 'var(--danger)';

        // Banner Verdict
        const verdictBanner = document.getElementById('verdictBanner');
        const verdictText = document.getElementById('verdictText');
        const verdictSubtext = document.getElementById('verdictSubtext');

        if (financialSavingsSgd > 0) {
            verdictBanner.className = 'verdict-banner';
            verdictText.textContent = 'Mission Accomplished! 💸';
            verdictSubtext.textContent = `You will save a total of $${financialSavingsSgd.toFixed(2)} on this trip.`;
        } else {
            verdictBanner.className = 'verdict-banner negative';
            verdictText.textContent = 'You are losing money! 🛑';
            verdictSubtext.textContent = `Pumping in SG is cheaper by $${Math.abs(financialSavingsSgd).toFixed(2)}! Total costs overshadow fuel savings.`;
        }

        elements.resultsPanel.style.display = 'block';
        elements.resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
});
