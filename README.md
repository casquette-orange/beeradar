# Beeradar

Beeradar est une application web légère qui trouve le bar le plus proche et oriente l'utilisateur vers lui.

## Fonctionnalités

- localisation de l'utilisateur via `navigator.geolocation`
- recherche de bars à proximité avec l'API Overpass OpenStreetMap
- calcul de la distance en mètres avec la formule de Haversine
- calcul de l'azimut pour indiquer la direction du bar
- boussole visuelle qui pivote selon l'orientation du téléphone

## Comment utiliser

1. Ouvrir `index.html` via HTTPS ou un serveur local.
2. Cliquer sur le bouton `Trouver un bar`.
3. Accepter la localisation GPS.
4. Si disponible, autoriser l'accès au capteur d'orientation pour activer la boussole.

## Limitations

- nécessite un accès HTTPS/serveur local pour la géolocalisation et les capteurs mobiles
- la boussole fonctionne mieux sur mobile et dans les navigateurs qui exposent `deviceorientation`
- Safari iOS demande souvent une autorisation explicite du capteur d'orientation
- l'application dépend de la disponibilité du service Overpass API

## Structure du projet

- `index.html` : interface utilisateur
- `style.css` : styles de présentation
- `app.js` : logique de géolocalisation, requête Overpass et affichage de la boussole