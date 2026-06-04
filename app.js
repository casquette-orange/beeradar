const button = document.getElementById("searchButton");
const statusDiv = document.getElementById("status");
const compass = document.getElementById("compass");
const debugDiv = document.getElementById("debug");

let targetBearing = null;
let currentHeading = null;
let compassRotation = 0;
let orientationListenerAdded = false;
let watchId = null;
let nearestBar = null;

button.addEventListener("click", async () => {
    statusDiv.innerHTML = "Recherche de votre position...";

    if (!navigator.geolocation) {
        statusDiv.innerHTML = "GPS non supporté";
        return;
    }

    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }

    await initDeviceOrientation();

    navigator.geolocation.getCurrentPosition(
        onSuccess,
        onError,
        {
            enableHighAccuracy: true
        }
    );
});

async function initDeviceOrientation() {
    if (orientationListenerAdded) {
        return;
    }

    if (
        typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
        try {
            const permission = await DeviceOrientationEvent.requestPermission();

            if (permission === "granted") {
                window.addEventListener("deviceorientation", onDeviceOrientation);
                orientationListenerAdded = true;
            } else {
                debugDiv.innerHTML = "Permission orientation refusée";
            }
        } catch (error) {
            console.warn("Erreur permission orientation", error);
            debugDiv.innerHTML = "Impossible d'accéder au capteur d'orientation";
        }
    } else {
        window.addEventListener("deviceorientation", onDeviceOrientation);
        orientationListenerAdded = true;
    }
}

async function onSuccess(position) {
    const userLat = position.coords.latitude;
    const userLon = position.coords.longitude;

    statusDiv.innerHTML = "Recherche des bars...";

    try {
        const bars = await getNearbyBars(userLat, userLon);

        if (!bars || bars.length === 0) {
            statusDiv.innerHTML = "Aucun bar trouvé 🍺";
            return;
        }

        nearestBar = findNearestBar(userLat, userLon, bars);

        if (!nearestBar) {
            statusDiv.innerHTML = "Aucun bar valide trouvé 🍺";
            return;
        }

        updateBarState(userLat, userLon);
        renderStatus();
        updateCompass();
        startLocationWatcher();
    } catch (error) {
        console.error(error);
        statusDiv.innerHTML = "Erreur lors de la recherche des bars";
    }
}

function onError(error) {
    statusDiv.innerHTML = `Erreur GPS : ${error.message}`;
}

async function getNearbyBars(lat, lon) {
    const radius = 1000;

    const query = `
[out:json];
(
  node["amenity"="bar"](around:${radius},${lat},${lon});
  node["amenity"="pub"](around:${radius},${lat},${lon});
);
out body;
`;

    const response = await fetch(
        "https://overpass-api.de/api/interpreter",
        {
            method: "POST",
            body: query
        }
    );

    if (!response.ok) {
        throw new Error(`Service Overpass indisponible (${response.status})`);
    }

    const data = await response.json();

    if (!data?.elements || !Array.isArray(data.elements)) {
        throw new Error("Réponse invalide du service de recherche");
    }

    return data.elements.filter(
        (element) =>
            typeof element.lat === "number" &&
            typeof element.lon === "number"
    );
}

function findNearestBar(userLat, userLon, bars) {
    let nearest = null;
    let minDistance = Infinity;

    for (const bar of bars) {
        const distance = haversineDistance(
            userLat,
            userLon,
            bar.lat,
            bar.lon
        );

        if (distance < minDistance) {
            minDistance = distance;
            nearest = {
                name: bar.tags?.name || "Bar inconnu",
                lat: bar.lat,
                lon: bar.lon,
                distance
            };
        }
    }

    return nearest;
}

function updateBarState(userLat, userLon) {
    if (!nearestBar) {
        return;
    }

    nearestBar.distance = haversineDistance(
        userLat,
        userLon,
        nearestBar.lat,
        nearestBar.lon
    );

    targetBearing = calculateBearing(
        userLat,
        userLon,
        nearestBar.lat,
        nearestBar.lon
    );
}

function renderStatus() {
    if (!nearestBar) {
        statusDiv.innerHTML = "Aucun bar à afficher.";
        return;
    }

    statusDiv.innerHTML = `
        <div style="font-size:32px;">🍺</div>
        <div style="
            font-size:clamp(24px, 6vw, 40px);
            font-weight:bold;
            margin-top:10px;
        ">
            ${nearestBar.name}
        </div>
        <div style="
            font-size:clamp(40px, 10vw, 70px);
            margin-top:20px;
        ">
            ${nearestBar.distance.toFixed(0)} m
        </div>
        <div style="margin-top:12px; font-size:1rem; opacity:0.9;">
            Tournez votre téléphone pour pointer vers le bar.
        </div>
    `;
}

function startLocationWatcher() {
    if (!navigator.geolocation || watchId !== null) {
        return;
    }

    watchId = navigator.geolocation.watchPosition(
        onPositionUpdate,
        onError,
        {
            enableHighAccuracy: true,
            maximumAge: 1000,
            timeout: 10000
        }
    );
}

function onPositionUpdate(position) {
    const userLat = position.coords.latitude;
    const userLon = position.coords.longitude;

    if (!nearestBar) {
        return;
    }

    updateBarState(userLat, userLon);
    renderStatus();
    updateCompass();
}

function calculateBearing(lat1, lon1, lat2, lon2) {
    const φ1 = toRadians(lat1);
    const φ2 = toRadians(lat2);

    const λ1 = toRadians(lon1);
    const λ2 = toRadians(lon2);

    const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
    const x =
        Math.cos(φ1) * Math.sin(φ2) -
        Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);

    let bearing = (Math.atan2(y, x) * 180) / Math.PI;
    return (bearing + 360) % 360;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) ** 2;

    const c =
        2 *
        Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

function toRadians(degrees) {
    return (degrees * Math.PI) / 180;
}

function onDeviceOrientation(event) {
    const heading = event.webkitCompassHeading ?? event.alpha;

    if (heading == null) {
        return;
    }

    currentHeading = heading;
    updateCompass();

    const compassHeading = typeof event.webkitCompassHeading === "number"
        ? event.webkitCompassHeading
        : event.alpha;

    debugDiv.innerHTML = `
        heading : ${compassHeading.toFixed(1)}°<br>
        absolute : ${event.absolute}
    `;
}

function updateCompass() {
    if (targetBearing == null || currentHeading == null) {
        return;
    }

    const desiredRotation = getShortestRotation(targetBearing, currentHeading);
    const rotationDelta = getShortestRotation(desiredRotation, compassRotation);
    compassRotation += rotationDelta;
    compass.style.transform = `rotate(${compassRotation}deg)`;
}

function getShortestRotation(target, current) {
    return ((target - current + 540) % 360) - 180;
}

window.addEventListener("load", () => {
    compass.innerText = "↑";
});