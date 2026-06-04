const button = document.getElementById("searchButton");
const statusDiv = document.getElementById("status");
const compass = document.getElementById("compass");

let targetBearing = 0;

button.addEventListener("click", async () => {

    await enableCompass();

    statusDiv.innerHTML =
        "Recherche de votre position...";

    if (!navigator.geolocation) {

        statusDiv.innerHTML =
            "GPS non supporté";

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

async function enableCompass() {

    try {

        if (
            typeof DeviceOrientationEvent !== "undefined"
            &&
            typeof DeviceOrientationEvent.requestPermission === "function"
        ) {

            const permission =
                await DeviceOrientationEvent.requestPermission();

            if (permission !== "granted") {

                statusDiv.innerHTML =
                    "Permission boussole refusée";

                return;
            }
        }

    } catch (e) {

        console.error(e);
    }
}

async function onSuccess(position) {

    const userLat = position.coords.latitude;
    const userLon = position.coords.longitude;

    statusDiv.innerHTML =
        "Recherche des bars...";

    try {

        const bars =
            await getNearbyBars(
                userLat,
                userLon
            );

        if (bars.length === 0) {

            statusDiv.innerHTML =
                "Aucun bar trouvé 🍺";

            return;
        }

        const nearestBar =
            findNearestBar(
                userLat,
                userLon,
                bars
            );

        targetBearing =
            calculateBearing(
                userLat,
                userLon,
                nearestBar.lat,
                nearestBar.lon
            );

        statusDiv.innerHTML = `
            <div style="font-size:34px;">
                🍺
            </div>

            <div style="
                font-size:36px;
                font-weight:bold;
                margin-top:10px;
            ">
                ${nearestBar.name}
            </div>

            <div style="
                font-size:60px;
                margin-top:20px;
            ">
                ${nearestBar.distance.toFixed(0)} m
            </div>
        `;

    } catch (error) {

        console.error(error);

        statusDiv.innerHTML =
            "Erreur lors de la recherche des bars";
    }
}

function onError(error) {

    statusDiv.innerHTML =
        `Erreur GPS : ${error.message}`;
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

function findNearestBar(
    userLat,
    userLon,
    bars
) {

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

                name:
                    bar.tags?.name ||
                    "Bar inconnu",

                lat: bar.lat,
                lon: bar.lon,

                distance
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
        Math.sin(λ2 - λ1)
        * Math.cos(φ2);

    const x =
        Math.cos(φ1)
        * Math.sin(φ2)
        -
        Math.sin(φ1)
        * Math.cos(φ2)
        * Math.cos(λ2 - λ1);

    let bearing =
        Math.atan2(y, x)
        * 180
        / Math.PI;

    bearing =
        (bearing + 360)
        % 360;

    return bearing;
}

function shortestAngle(
    target,
    current
) {

    let delta =
        target - current;

    delta =
        ((delta + 540) % 360)
        - 180;

    return delta;
}

window.addEventListener(
    "deviceorientation",
    (event) => {

        statusDiv.innerHTML = `
            alpha : ${event.alpha}<br>
            absolute : ${event.absolute}
        `;
    }
);

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
        Math.sin(dLat / 2) ** 2
        +
        Math.cos(
            toRadians(lat1)
        )
        *
        Math.cos(
            toRadians(lat2)
        )
        *
        Math.sin(
            dLon / 2
        ) ** 2;

    const c =
        2 * Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );

    return R * c;
}

function toRadians(degrees) {

    return degrees *
        Math.PI /
        180;
}

console.log(
    event.alpha,
    event.absolute
);