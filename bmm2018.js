
let date, time=[];
const d0 = new Date(2018,01,01);
jQuery.getJSON('/2018/assets/date.json', function(data){
	date=data;
	var d = new Date(d0);
	for (var i = 0; i < date.length; i += 1) {
		d.setMinutes(d.getMinutes() + 15);
		if (date[i]>0){
			time.push(d.toISOString().slice(0,16).replace('T',' '));
		}
	}
})

mapboxgl.accessToken = 'pk.eyJ1IjoicmFmbnVzcyIsImEiOiIzMVE1dnc0In0.3FNMKIlQ_afYktqki-6m0g';
const map = new mapboxgl.Map({
	container: 'map',
	style: 'mapbox://styles/mapbox/satellite-v9',
	center: [4.5, 49],
	zoom: 4,
});


/*
DRAW PLUGIN
var draw_poly = new MapboxDraw();
map.addControl(draw_poly);
map.on('draw.create', function(e){
	if (e.features[0].geometry.type == 'Point'){
		console.log('Point')
		oReq_ll.open("GET", "/2018/assets/bin/ll_" + findNearest(e.features[0].geometry.coordinates) + ".bin", true);
		oReq_ll.send(null);
	} else if (e.features[0].geometry.type == 'Polygon') {
		
	} else if (e.features[0].geometry.type == 'Polyline') {
		
	}
});
map.on('draw.delete', function(e){
	
});
map.on('draw.update', function(e){
	
});

var findNearest = function(latlng){
	var est_grid = quiver_geojson.features.map( (x) => x.geometry.coordinates);
	var acc = est_grid.reduce(function(acc, curr, id_curr) {
		val = Math.pow((est_grid[id_curr][0] - latlng[0]),2) + Math.pow((est_grid[id_curr][1] - latlng[1]),2);
		return val < acc[0] ? [val, id_curr] : acc;
	},[20,-1]);
	return acc[1]
}
*/










let grid_geojson, quiver_geojson, radar_geojson, timer, speed, resolution, skip, logscale, raincheck, color, gauge;
let dens, u, v, rain;
var loaded_count=0;
var load_nb = 5;


var oReq = new XMLHttpRequest();
oReq.responseType = "arraybuffer";

oReq.onload = function (oEvent) {
	if (oReq.response) {
		var byteArray = new Int16Array(oReq.response);
		for (var i = 1; i < byteArray.length; i++) {
			byteArray[i] = byteArray[i-1] + byteArray[i];//+ ( ( byteArray[i] >> 1 ) ^ -( byteArray[i] & 0x1 ) );
		}
		const chunk = 2025;
		var data = new Array( Math.ceil(byteArray.length/chunk) );
		var j = 0
		for (let i=0; i<byteArray.length; i+=chunk) { 
			data[j] = byteArray.slice(i,i+chunk);
			j += 1;
		}
		dens = data.slice(0,data.length/3);
		u = data.slice(data.length/3,data.length/3*2)
		v = data.slice(data.length/3*2,data.length)
		
		
		loaded_count +=1;
		if (loaded_count==load_nb){
			loaded()
		}
	}
};
oReq.onprogress = function(oEvent) {
	if (oEvent.lengthComputable) {
		var percentComplete = Math.round((oEvent.loaded / oEvent.total) * 100);
		jQuery('#progressbar').css('width',percentComplete+'%')
	} else {
		var percentComplete = Math.round((oEvent.loaded / 182104200) * 100);
		jQuery('#progressbar').css('width',percentComplete+'%')
	}
};
oReq.open("GET", "/2018/assets/density.bin", true);



var oReq2 = new XMLHttpRequest();
oReq2.responseType = "arraybuffer";
oReq2.onload = function (oEvent) {
	if (oReq2.response) {
		byteArray = new Uint8Array(oReq2.response);
		const chunk = 2025;
		rain = new Array( Math.ceil(byteArray.length/chunk) );
		var j = 0
		for (let i=0; i<byteArray.length; i+=chunk) { 
			rain[j] = byteArray.slice(i,i+chunk);
			j += 1;
		}
		
		loaded_count +=1;
		if (loaded_count==load_nb){
			loaded()
		}
	}
};
oReq2.open("GET", "/2018/assets/rain.bin", true);


if (!window.matchMedia("only screen and (max-width: 760px)").matches) {
	oReq.send(null);
	oReq2.send(null);
}




map.on('load', function() {
	
	color = jQuery('input[name="radio-bar"]:checked').val();
	jQuery.getJSON('/2018/assets/grid.geojson', function(geojson){
		grid_geojson = geojson;
		map.addSource('grid_source', { 
			type: 'geojson', 
			data: grid_geojson
		});
		
		map.addLayer({
			id: 'grid_layer',
			type: 'fill',
			source: 'grid_source',
			paint: {
				"fill-color": getFillColor(color),
				"fill-opacity": parseFloat(jQuery('#opacity').val()),
			},
			"filter": ["!=", "value", 0]
		})
		loaded_count +=1;
		if (loaded_count==load_nb){
			loaded()
		}
	})
	
	jQuery.getJSON('/2018/assets/quiver.geojson', function(geojson){
		
		quiver_geojson = geojson;
		quiver_geojson.features = quiver_geojson.features.map( r => {
			r.properties.size = 0
			r.properties.angle = 0
			return r
		});

		map.loadImage('/2018/assets/right-arrow-grey.png', function(error, image) {
			map.addImage('arrow', image);
			
			
			map.addSource('quiver_source', { 
				type: 'geojson', 
				data: quiver_geojson,
				/*"cluster": false,
				"clusterRadius": 80,
				"clusterProperties": {
					//"angle": ["get", "angle"],//["/", ["+", ["get", "angle"]] , ["+", ["accumulated"], 1] ],
					//"size": [["+", ["accumulated"], ["get", "size"]], ["get", "size"]]
					//["+", ["case", [">",["get", "size"],0], 1, 0]],
					"size": "point_count_abbreviated"//["+", ["get", "size"]]
				}*/
			});
			
			map.addLayer({
				id: 'quiver_layer',
				type: 'symbol',
				source: 'quiver_source',
				"layout": {
					"icon-image": "arrow",
					"icon-rotate": ['get', 'angle'],
					"icon-size": ['get', 'size'],
				},
				"filter":  ["all", ["!=", "angle", 0], ["!=", "size", 0]]
			})

			loaded_count +=1;
			if (loaded_count==load_nb){
				loaded()
			}
		})
	})

	jQuery.getJSON('/2018/assets/radar.geojson', function(geojson){
		radar_geojson = geojson;

		// Initite with 0 data (invisiable on map)
		radar_geojson.features = radar_geojson.features.map( r => {
			r.properties.value = 0
			r.properties.size = 0
			r.properties.angle = 0
			return r
		});

		map.addSource('radar_source', { 
			type: 'geojson', 
			data: radar_geojson
		});
		
		map.addLayer({
			id: 'radar_layer',
			type: 'circle',
			source: 'radar_source',
			paint: {
				"circle-color": getFillColor(color),
				//"circle-opacity": parseFloat(jQuery('#opacity').val()),
				'circle-stroke-width' : 1,
				//'circle-stroke-color' : '#FFFFFF',
				'circle-radius': 6,
			},
			"filter": ["!=", "value", 0]
		})

		map.loadImage('/2018/assets/right-arrow-black.png', function(error, image) {
			map.addImage('arrow-radar', image);
			map.addLayer({
				id: 'radar_quiver_layer',
				type: 'symbol',
				source: 'radar_source',
				"layout": {
					"icon-image": "arrow-radar",
					"icon-rotate": ['get', 'angle'],
					"icon-size": ['get', 'size'],
				},
				"filter":  ["all", ["!=", "angle", 0], ["!=", "size", 0]]
			})
		})

		loaded_count +=1;
		if (loaded_count==load_nb){
			loaded()
		}
	})
	






	jQuery('#btn-go').on('click',function(){
		jQuery('#modal-loading').hide()
		jQuery('#modal-title').hide()
		jQuery('#btn-go').hide()
		animate()
	})
	jQuery('#howtonav').on('click',function(){
		jQuery('#modal-loading').show()
		if (!jQuery('#ppeButton-i').hasClass('fa-play')) {
			clearTimeout(timer)
			jQuery('#ppeButton-i').toggleClass('fa-play fa-pause');
		}
	})
	jQuery('#modal-close').on('click', function(){
		jQuery('#modal-loading').hide()
	})
	jQuery('#modal-loading').not("#modal-content").click(function(e){
		if (e.target.id == 'modal-bkg' && jQuery('#modal-close').is(':visible') ){
			jQuery('#modal-loading').hide()
		}
	  })
	  
	

	jQuery('input[name="radio-bar"]').each( function(i, e){
		jQuery(e).after("<div class='h18 bar' style='background: linear-gradient(to right, "+colorbrewer[jQuery(e).attr('value')][9].join(',')+"'></div>")
	})
	jQuery('.bar').hover( ()=> {jQuery('.bar').show()} , ()=> {jQuery('.bar').hide()} )
	jQuery('.bar').on('click', function(e){
		jQuery('.bar').hide()
		color = this.previousElementSibling.value;
		map.setPaintProperty('grid_layer','fill-color',getFillColor(color))
		map.setPaintProperty('radar_layer','circle-color',getFillColor(color))
	})

	resolution = parseInt(jQuery('#resolution').val());

	jQuery('#speed').on('change', function() {
		speed=parseInt(this.value);
		jQuery('#speed-toltip').html(this.value+' frames/sec')
	});
	speed=parseInt(jQuery('#speed').val());
	skip = jQuery('#neeButton').hasClass('active');
	jQuery('#speed-div').hover(
		() => { jQuery('#speed').animate({width: 'toggle'});},
		() => { jQuery('#speed').animate({width: 'toggle'});}
		); 
		
		logscale=jQuery('#logscale').prop("checked");
		jQuery('#logscale').on('change', function() {
			logscale=jQuery('#logscale').prop("checked");
			map.setPaintProperty('grid_layer','fill-color',getFillColor(color))
			map.setPaintProperty('radar_layer','circle-color',getFillColor(color))
		});
	
		jQuery('#opacity').on('change', function() {
			map.setPaintProperty('grid_layer','fill-opacity', parseFloat(jQuery('#opacity').val())) 
			map.setPaintProperty('radar_layer','circle-color',getFillColor(color))
		})

		jQuery('#radar').on('change', function() {
			if (jQuery('#radar').prop("checked")){
				map.setLayoutProperty('radar_layer', 'visibility', 'visible');
				map.setLayoutProperty('radar_quiver_layer', 'visibility', 'visible');
			} else {
				map.setLayoutProperty('radar_layer', 'visibility', 'none');
				map.setLayoutProperty('radar_quiver_layer', 'visibility', 'none');
			}
		});

		raincheck=jQuery('#rain').prop("checked");
		jQuery('#rain').on('change', function() {
			raincheck=jQuery('#rain').prop("checked");
		});
		
	});
	
	var popup = new mapboxgl.Popup();	
	map.on('click', 'grid_layer', function(e) {
		popup.setLngLat(e.lngLat) //e.features[0].geometry.coordinates[0][0]
		.setHTML('<b>Density:</b> ' + Math.round(e.features[0].properties.value)+ ' bird/km<sup class="txt-sup">2</sup><br>'+
		'<b>Speed:</b> ' + Math.round(e.features[0].properties.speed)+' m/s<br>'+
		'<b>Direction:</b> ' + Math.round(e.features[0].properties.angle)+'°')
		.addTo(map);
	});
	map.on('click', 'radar_layer', function(e) {
		popup.setLngLat(e.lngLat) //e.features[0].geometry.coordinates[0][0]
		.setHTML('<b>Radar name: </b>' + e.features[0].properties.name + '<br>'+
			'<b>Density:</b> ' + Math.round(e.features[0].properties.value)+ ' bird/km<sup class="txt-sup">2</sup><br>'+
			'<b>Speed:</b> ' + Math.round(e.features[0].properties.speed)+' m/s<br>'+
			'<b>Direction:</b> ' + Math.round(e.features[0].properties.angle)+'°')
		.addTo(map);
	});
	map.on('mouseenter', 'grid_layer', function() {
		map.getCanvas().style.cursor = 'pointer';
	});
	map.on('mouseleave', 'grid_layer', function() {
		map.getCanvas().style.cursor = '';
	});



	let gd_density;//, gd_sum, gd_mtr;
	const s = document.getElementById("slider");
	jQuery(document).ready(function() {
		
		gauge = new JustGage({
			id: "gauge",
			value: 0,
			min: 0,
			max: 90,
			valueFontColor: '#F7F5C5',
			label: "Millions of birds",
		});
		
		jQuery('#gauge > svg > text').css('font-family','inherit');
		jQuery('#gauge > svg > text:nth-child(5)').css('font-size','50px');
		jQuery('#gauge > svg > text:nth-child(6)').css('font-size','14px');
		jQuery('#gauge > svg > text:nth-child(7)').css('font-size','12px');
		jQuery('#gauge > svg > text:nth-child(8)').css('font-size','12px');
		
		jQuery('#tlButton').on('click', function(){
			jQuery("#timelinediv").toggle();
			jQuery('#tlButton').toggleClass('active')
			Plotly.Plots.resize(gd_density);
		})
		
		d3colors = Plotly.d3.scale.category10();
		col=[]
		for (var i = 0; i < 11; i += 1) {
			col.push(d3colors(i));
		}
		
		jQuery.getJSON('/2018/assets/MTR.json',function(MTR){
			
			gd_style ={
				width: '100%',
				'margin-left': '0px',
				height: '290px',
				'max-height': 'calc( 100vh - 105px )',
				'margin-top': '0px'
			};
			
			gd_density = document.getElementById('plot_density');
			//gd_sum = document.getElementById('plot_sum'); 
			//gd_mtr = document.getElementById('plot_mtr'); 
			// Plotly.d3.select(gd_density).style(gd_style).node();
			//Plotly.d3.select(gd_sum).style(gd_style).node();
			//Plotly.d3.select(gd_mtr).style(gd_style).node();
			
			var layout = {
				autosize:true,
				margin: {
					l: 35,
					r: 35,
					b: 15,
					t: 0,
				},
				showlegend: true,
				legend: {"orientation": "h", x: 0,y: 1},
				xaxis: {
					range: ['2018-01-01 00:00:00', '2019-01-01 00:00:00'],
					rangeselector: {buttons: [
						{
							count: 1,
							label: '1d',
							step: 'day',
							stepmode: 'backward'
						},
						{
							count: 7,
							label: '1w',
							step: 'day',
							stepmode: 'backward'
						},
						{step: 'all'}
					]
				},
				type: 'date'
			},
			yaxis: {
				title: 'Bird Movement (Distance traveled by all birds in 15min) [bird*km]',
				autorange: true,
				type: 'linear',
			},
			shapes: [  {
				type: "line",
				x0: '2018-01-01 00:00:00',
				x1: '2018-01-01 00:00:00',
				y0: 0,
				y1: 1,
				yref: "paper",
				line: {
					color: '#7F7F7F',
					width: 2,
					dash: 'dot'
				},
			}]
		};
		
		var data = {
			x: time, 
			y: MTR.map(x => x*1000000), 
			mode: "lines", 
			//name: name,
			type: "scatter",
			//legendgroup: 'group'+gd.i_group,
			hoverinfo:'none'
		};
		Plotly.newPlot(gd_density, [data], layout,  {modeBarButtonsToRemove: ['toImage','sendDataToCloud','hoverCompareCartesian','hoverClosestCartesian','hoverCompareCartesian','resetScale2d','zoomIn2d','zoomOut2d']});
		//Plotly.newPlot(gd_sum, [], layout,  {modeBarButtonsToRemove: ['toImage','sendDataToCloud','hoverCompareCartesian','hoverClosestCartesian','hoverCompareCartesian','resetScale2d','zoomIn2d','zoomOut2d']});
		//Plotly.newPlot(gd_mtr, [], layout,  {modeBarButtonsToRemove: ['toImage','sendDataToCloud','hoverCompareCartesian','hoverClosestCartesian','hoverCompareCartesian','resetScale2d','zoomIn2d','zoomOut2d']});
		
		setTimeout(function (){
			jQuery('[data-title="Toggle Spike Lines"]').remove();
			jQuery('[data-title="Produced with Plotly"]').remove()
			jQuery('[data-title="Lasso Select"]').remove()
			jQuery('[data-title="Box Select"]').remove()
		}, 2000);
		
	})
})










const quiver_resize_factor = 20;

const sliderchange = function(){
	if (date[s.value]>0){
		map.setLayoutProperty('grid_layer', 'visibility', 'visible');
		map.setLayoutProperty('quiver_layer', 'visibility', 'visible');
		//map.setLayoutProperty('radar_layer', 'visibility', 'visible');
		//oReq.open("GET", "/2018/assets/bin/density_" + String(date[s.value]) + ".bin", true);
		//oReq.send(null);
		
		let dt = dens[date[s.value]]
		let ut = u[date[s.value]]
		let vt = v[date[s.value]]
		if (raincheck){
			var rt = rain[date[s.value]]
		} else {
			var rt = new Array(grid_geojson.features.length).fill(0);
		}

		for (var i = 0, len = grid_geojson.features.length; i < len; i++) {
			const x = (ut[i]==0 | rt[i]) ? 0 : ut[i]/100-30;
			const y = (vt[i]==0 | rt[i]) ? 0 : vt[i]/100-30;
			quiver_geojson.features[i].properties.angle = Math.atan2(y,x) * (180/Math.PI) - 90;
			quiver_geojson.features[i].properties.size =  Math.min(1, Math.sqrt(x*x + y*y)/quiver_resize_factor);

			grid_geojson.features[i].properties.value = rt[i] ? 0 : dt[i]/100;
			grid_geojson.features[i].properties.angle = quiver_geojson.features[i].properties.angle;
			grid_geojson.features[i].properties.speed = quiver_geojson.features[i].properties.size*quiver_resize_factor;
		}
		map.getSource('grid_source').setData(grid_geojson);
		map.getSource('quiver_source').setData(quiver_geojson);

		radar_geojson.features = radar_geojson.features.map( r => {
			const x = r.properties.u[date[s.value]]==0 ? 0 : r.properties.u[date[s.value]]/100-30;
			const y = r.properties.v[date[s.value]]==0 ? 0 : r.properties.v[date[s.value]]/100-30;
			r.properties.angle = Math.atan2(y,x) * (180/Math.PI) - 90;
			r.properties.size = Math.min(1, Math.sqrt(x*x + y*y)/quiver_resize_factor);
			r.properties.speed = r.properties.size * quiver_resize_factor;
			r.properties.value = r.properties.dens[date[s.value]]/100
			return r
		});
		map.getSource('radar_source').setData(radar_geojson);

		gauge.refresh(dt.reduce( (a,i) => {return a+i})/100*500/1000000); // 500 convert bird/km^2 -> bird, 1000000 to Millions
		jQuery('#tt-nb-div').removeClass('day').addClass('night')
		jQuery('#tt-sun').removeClass('fa-sun').addClass('fa-moon')
		jQuery('#gauge > svg > text:nth-child(5) > tspan').removeClass('day').addClass('night')
	} else if (skip) {
		i=0
		while (date[parseFloat(s.value)+i] == 0){
			i++
		}
		s.stepUp(i);
		sliderchange()
	} else {
		map.setLayoutProperty('grid_layer', 'visibility', 'none');
		map.setLayoutProperty('quiver_layer', 'visibility', 'none');
		map.setLayoutProperty('radar_layer', 'visibility', 'none');
		gauge.refresh(dens[date[s.value]].reduce( (a,i) => {return a+i})/100*500/1000000);
		jQuery('#tt-nb-div').removeClass('night').addClass('day')
		jQuery('#tt-sun').removeClass('fa-moon').addClass('fa-sun')		
		jQuery('#gauge > svg > text:nth-child(5) > tspan').removeClass('night').addClass('day')
	}
	let d = new Date(d0.getTime() + s.value*15*60000);
	const d_s = d.toISOString().slice(0,16).replace('T',' ');
	jQuery('#date').html(d_s.replace(' ','&nbsp;'))
	
	Plotly.relayout(gd_density, {'shapes[0].x0':d_s,'shapes[0].x1':d_s})
	//Plotly.relayout(gd_sum, {'shapes[0].x0':d_s,'shapes[0].x1':d_s})
	//Plotly.relayout(gd_mtr, {'shapes[0].x0':d_s,'shapes[0].x1':d_s})
};

const loaded = () => {
	jQuery('#btn-go').show()
	jQuery('#progressbardiv').hide()
	jQuery('#modal-title').html("Data loaded. Press 'Go' (bottom) when ready!")
	jQuery('#modal-close').show()
	map.fitBounds([
		[-2.406277,42.878452],
		[16.042070,55.527677]
		],{
			padding: {top: 0, bottom:60, left: 228, right: 252}
		});
}

const animate = () => {
	s.stepUp(resolution);
	sliderchange()
	timer = setTimeout(animate, 1000/speed)
}

const getFillColor = (color) => {
	var max = parseFloat(jQuery('#caxismax').val());
	var min = parseFloat(jQuery('#caxismin').val());

	var c = ['interpolate',	['linear'],	['get', 'value']];

	if (logscale){

		max = Math.log(max)
		min = Math.log(min);

		var step = (max - min) / (9 - 1);
		for (var i = 0; i < 9; i++) {
			c.push( Math.exp( min + (step * i)))
			c.push(colorbrewer[color][9][i])
		}
	} else {
		var step = (max - min) / (9 - 1);
		for (var i = 0; i < 9; i++) {
			c.push(min + (step * i))
			c.push(colorbrewer[color][9][i])
		}
	}
	return c
}

const ppeButton = () => {
	if (jQuery('#ppeButton-i').hasClass('fa-play')) {
		animate();
	} else {
		clearTimeout(timer)
	}
	jQuery('#ppeButton-i').toggleClass('fa-play fa-pause');
}
const bweButton = () => {
	s.stepDown(resolution);
	sliderchange()
};

const fweButton = () => {
	s.stepUp(resolution);
	sliderchange()
};
const neeButton = () => {
	jQuery('#neeButton').toggleClass('active')
	skip = jQuery('#neeButton').hasClass('active')
};


document.addEventListener("keydown", function(event){
	if (event.which == '32'){
		ppeButton()
	} else if (event.which == '39'){
		event.preventDefault();
		fweButton()
	} else if (event.which == '37'){
		event.preventDefault();
		bweButton()
	}
});




/*function openTab(evt, cityName) {
	jQuery(".tabcontent").hide();
	jQuery("#"+cityName).show();
	jQuery(".tablinks").removeClass("is-active");
	jQuery(evt.target).addClass("is-active");
	Plotly.Plots.resize(jQuery("#"+cityName)[0]);
}


var oReq_ll = new XMLHttpRequest();
oReq_ll.responseType = "arraybuffer";

oReq_ll.onload = function (oEvent) {
	if (oReq_ll.response) {
		const byteArray = new Uint16Array(oReq_ll.response);
		const chunk = 2207;
		let dens=[]
		for (let i=0; i<byteArray.length; i+=chunk) { 
			dens = [...dens, byteArray.slice(i,i+chunk)];
		} 
		
		Plotly.addTraces(gd_density,{
			x: time, 
			y: dens[0], 
			mode: "lines", 
			name: name,
			type: "scatter",
			//legendgroup: 'group'+gd.i_group,
			hoverinfo:'none'
		});
		
	}
};
*/




















