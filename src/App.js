import { useRef, useEffect, useState } from 'react'
import * as tt from '@tomtom-international/web-sdk-maps'
import * as ttapi from '@tomtom-international/web-sdk-services'
import './App.css'
import '@tomtom-international/web-sdk-maps/dist/maps.css'

const App = () => {
  const mapElement = useRef()
  const [map, setMap] = useState({})
  const [longitude, setLongitude] = useState(null)
  const [latitude, setLatitude] = useState(null)
  const [att, setAtt] = useState({})

  // if (localStorage.getItem('latitude')) {
  //   console.log(localStorage.getItem('latitude'))
  //   console.log(localStorage.getItem('longitude'))
  // }
  const [youPosition, setYouPosition] = useState({
    lat: null,
    lng: null,
  })

  const convertToPoints = (lngLat) => {
    return {
      point: {
        latitude: lngLat.lat,
        longitude: lngLat.lng
      }
    }
  }

  const drawRoute = (geoJson, map) => {
    if (map.getLayer('route')) {
      map.removeLayer('route')
      map.removeSource('route')
    }
    map.addLayer({
      id: 'route',
      type: 'line',
      source: {
        type: 'geojson',
        data: geoJson
      },
      paint: {
        'line-color': '#e600e6',
        'line-width': 6

      }
    })
  }

  const addDeliveryMarker = (lngLat, map) => {

    const element = document.createElement('div')
    element.className = 'marker-delivery'
    new tt.Marker({
      element: element
    })
      .setLngLat(lngLat)
      .addTo(map)

  }

  useEffect(() => {
    const origin = {
      lng: longitude,
      lat: latitude,
    }
    const destinations = []

    navigator.geolocation.getCurrentPosition((position) => {
      // localStorage.setItem('latitude', position.coords.latitude)
      // localStorage.setItem('longitude', position.coords.longitude)
      setYouPosition({
        lat: position.coords.latitude,
        lng: position.coords.longitude
      })
    })

    let map = tt.map({
      key: process.env.REACT_APP_TOM_TOM_API_KEY,
      container: mapElement.current,
      stylesVisibility: {
        trafficIncidents: true,
        trafficFlow: true,
      },
      center: [longitude, latitude],
      zoom: 14,
    })
    setMap(map)


    const addMarker = () => {
      const popupOffset = {
        bottom: [0, -25]
      }
      const popup = new tt.Popup({ offset: popupOffset }).setHTML('This is you!')
      const element = document.createElement('div')
      element.className = 'marker'

      const marker = new tt.Marker({
        draggable: true,
        element: element,
      })
        .setLngLat([longitude, latitude])
        .addTo(map)

      marker.on('dragend', () => {
        const lngLat = marker.getLngLat()
        setLongitude(lngLat.lng)
        setLatitude(lngLat.lat)
        setAtt({})
      })

      marker.setPopup(popup).togglePopup()

    }
    addMarker()

    const sortDestinations = (locations) => {
      const pointsForDestinations = locations.map((destination) => {
        return convertToPoints(destination)
      })
      const callParameters = {
        key: process.env.REACT_APP_TOM_TOM_API_KEY,
        destinations: pointsForDestinations,
        origins: [convertToPoints(origin)],
      }

      return new Promise((resolve, reject) => {
        ttapi.services
          .matrixRouting(callParameters)
          .then((matrixAPIResults) => {
            const results = matrixAPIResults.matrix[0]

            setAtt(results.lastItem.response.routeSummary)
            const resultsArray = results.map((result, index) => {
              return {
                location: locations[index],
                drivingtime: result.response.routeSummary.travelTimeInSeconds,

              }
            })
            resultsArray.sort((a, b) => {
              return a.drivingtime - b.drivingtime
            })
            const sortedLocations = resultsArray.map((result) => {
              return result.location
            })
            resolve(sortedLocations)
          })
      })
    }

    const recalculateRoutes = () => {
      sortDestinations(destinations).then((sorted) => {
        sorted.unshift(origin)

        ttapi.services
          .calculateRoute({
            key: process.env.REACT_APP_TOM_TOM_API_KEY,
            locations: sorted,
          })
          .then((routeData) => {
            const geoJson = routeData.toGeoJson()
            drawRoute(geoJson, map)
          })
      })
    }
    map.on('click', (e) => {
      destinations.push(e.lngLat)
      addDeliveryMarker(e.lngLat, map)
      recalculateRoutes()
    })

    return () => map.remove()

  }, [longitude, latitude])

  return (
    <>
      {map && (
        <div className="App">
          <div ref={mapElement} className="map" />
          <div className="search-bar">
            <button onClick={() => {
              setLatitude(youPosition.lat)
              setLongitude(youPosition.lng)
            }}>Find-Your-Position</button>
            <button onClick={() => {

              setAtt({})
            }}>Reset</button>
          </div>
        </div>
      )}
      <div>
        {
          att.lengthInMeters > 0 ?
            <>
              <h3>{"Total uzaklık : " + (att.lengthInMeters / 1000) + " km"}</h3>
              <h3 style={{ color: "red" }}> {att.travelTimeInSeconds > 0 ? "Tahmini Varış süresi : " + att.travelTimeInSeconds + " sn" : null}</h3>
              <h3>{att.departureTime.slice(11, 19)}</h3>
              <h3>{att.arrivalTime.slice(11, 19)}</h3>
              <h3> {"Price: " + (att.lengthInMeters / 1000 * 4.5 + 7).toFixed(3) + " lira"}</h3>
            </> : null
        }
      </div>
    </>
  )
}
export default App