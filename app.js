const button = document.getElementById("searchButton");
const statusDiv = document.getElementById("status");
const compass = document.getElementById("compass");

let targetBearing = 0;

button.addEventListener("click", async () => {

    statusDiv.textContent =
        "Recherche de votre position...";

    if (!navigator.geolocation) {

        statusDiv.textContent =
            "La géolocalisation n'est pas supportée.";

        return;
    }

    navigator.geolocation.getCurrentPosition(
        onSuccess,
        onError,
        {
            enableHighAccuracy: true
        }
    );
});

async function onSuccess(position) {

    const userLat = position.coords.latitude;
    const userLon = position.coords.longitude;

    statusDiv.innerHTML =
        "Position trouvée.<br>Recherche des bars...";

    try {

        const bars =
            await getNearbyBars(userLat, userLon);

        if (bars.length === 0) {

            statusDiv.textContent =
                "Aucun bar trouvé.";

            return;
        }

        const nearestBar =
            findNearestBar(
                userLat,
                userLon,
                bars
            );

        const bearing =
            calculateBearing(
                userLat,
                userLon,
                nearestBar.lat,
                nearestBar.lon
            );

        targetBearing = bearing;

        statusDiv.innerHTML = `
            <h3>🍺 Bar trouvé</h3>

            <b>${nearestBar.name}</b><br><br>

            Distance :
            ${nearestBar.distance.toFixed(0)} m<br><br>

            Cap :
            ${bearing.toFixed(0)}°<br><br>

            Latitude :
            ${nearestBar.lat}<br>

            Longitude :
            ${nearestBar.lon}
        `;

    } catch (error) {

        console.error(error);

        statusDiv.textContent =
            "Erreur lors de la recherche des bars.";
    }
}

function onError(error) {

    statusDiv.textContent =
        `Erreur GPS : ${error.code} - ${error.message}`;
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

    const data = await response.json();

    return data.elements;
}

function findNearestBar(userLat, userLon, bars) {

    let nearestBar = null;
    let minDistance = Infinity;

    for (const bar of bars) {

        const distance =
            haversineDistance(
                userLat,
                userLon,
                bar.lat,
                bar.lon
            );

        if (distance < minDistance) {

            minDistance = distance;

            nearestBar = {
                name: bar.tags?.name || "Bar inconnu",
                lat: bar.lat,
                lon: bar.lon,
                distance: distance
            };
        }
    }

    return nearestBar;
}

function calculateBearing(
    lat1,
    lon1,
    lat2,
    lon2
) {

    const φ1 = toRadians(lat1);
    const φ2 = toRadians(lat2);

    const λ1 = toRadians(lon1);
    const λ2 = toRadians(lon2);

    const y =
        Math.sin(λ2 - λ1) *
        Math.cos(φ2);

    const x =
        Math.cos(φ1) *
        Math.sin(φ2)
        -
        Math.sin(φ1) *
        Math.cos(φ2) *
        Math.cos(λ2 - λ1);

    let bearing =
        Math.atan2(y, x) *
        180 /
        Math.PI;

    bearing =
        (bearing + 360) % 360;

    return bearing;
}

function haversineDistance(
    lat1,
    lon1,
    lat2,
    lon2
) {

    const R = 6371000;

    const dLat =
        toRadians(lat2 - lat1);

    const dLon =
        toRadians(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) ** 2;

    const c =
        2 * Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );

    return R * c;
}

function toRadians(degrees) {

    return degrees * Math.PI / 180;
}

window.addEventListener(
    "deviceorientation",
    (event) => {

        statusDiv.innerHTML =
            `
            alpha=${event.alpha}<br>
            beta=${event.beta}<br>
            gamma=${event.gamma}
            `;

        if (event.alpha == null)
            return;

        compass.style.transform =
            `rotate(${event.alpha}deg)`;
    }
);