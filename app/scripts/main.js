function initialize() {

  $.getJSON( "data/data.json", function(data) {

    var curPoint, curPointId =0;

    var points = _(data.features)
      .filter(function(p){
        return  _.isNumber(p.geometry.coordinates[1]) || _.isNumber(p.geometry.coordinates[0]);
      })
      .sortBy(function(d){

        return d.properties.name;
      })
      .map(function(p){
        return {
          lat: p.geometry.coordinates[1],
          lng: p.geometry.coordinates[0],
          "name": p.properties.name,
          "description": p.properties.description
        }
      })
      .uniq()
      .value();

    console.log( "success, points:", points.length,points);



    var map;
    var panorama;

    var berkeley = {lat: 37.869085, lng: -122.254775};
    var sv = new google.maps.StreetViewService();

    panorama = new google.maps.StreetViewPanorama(document.getElementById('pano'));

    // Set up the map.
    map = new google.maps.Map(document.getElementById('map'), {
      center: berkeley,
      zoom: 16,
      streetViewControl: true,
      mapTypeId: google.maps.MapTypeId.SATELLITE
    });

    updatePos();

    function updatePos(){
      curPoint = points[curPointId%points.length];
      sv.getPanorama({location:curPoint, radius: 1000}, processSVData);
      map.setCenter(curPoint);

      console.log(curPointId, curPoint);
    }
    function processSVData(data, status) {
      var viewpointMarker = new google.maps.Marker({
        map: map,
        position: data.location.latLng
      });

      var targetMarker = new google.maps.Marker({
        map: map,
        position: curPoint,
        icon: 'https://google-developers.appspot.com/maps/documentation/javascript/examples/full/images/beachflag.png'
      });

      var path = [viewpointMarker.getPosition(), targetMarker.getPosition()];
      var heading = google.maps.geometry.spherical.computeHeading(path[0], path[1]);

      panorama.setPano(data.location.pano);
      panorama.setPov({
        heading:heading,
        pitch: 5
       });
      panorama.setVisible(true);
      map.setStreetView(panorama);

       _.isNull(data.location.latLng) ? panorama.setPov({pitch: 100 }) : ''

      $(".description").text(curPoint.description);
      $(".name").text(curPoint.name);

      var bounds = new google.maps.LatLngBounds(viewpointMarker.getPosition(), targetMarker.getPosition());


      console.error(google.maps.geometry.spherical.computeDistanceBetween(viewpointMarker.getPosition(), targetMarker.getPosition()));

      // // Don't zoom in too far on only one marker
      // if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
      //    var extendPoint1 = new google.maps.LatLng(bounds.getNorthEast().lat() + 0.05, bounds.getNorthEast().lng() + 0.05);
      //    var extendPoint2 = new google.maps.LatLng(bounds.getNorthEast().lat() - 0.05, bounds.getNorthEast().lng() - 0.05);
      //    bounds.extend(extendPoint1);
      //    bounds.extend(extendPoint2);
      // }

     bounds.extend(viewpointMarker.getPosition());
     bounds.extend(targetMarker.getPosition());
     map.fitBounds(bounds);

     map.setZoom(16);
     map.panTo(targetMarker.getPosition());

      viewpointMarker.setMap(null);

      if (status !== google.maps.StreetViewStatus.OK) {
        console.error('Street View data not found for this location.');
      }
    }
    $( "body" ).keypress(function( event ) {
      if ( event.which == 106 ) {
        curPointId++;
        updatePos();
      }
      if ( event.which == 107 ) {
        curPointId--;
        updatePos();
      }
    });


  })

}
