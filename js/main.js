mapboxgl.accessToken = 'pk.eyJ1IjoiYWVsa3VuY2h3YXIiLCJhIjoiY21oZWM5ZnBnMGRxNzJscHV5bmp4eXBidSJ9.lx_hyQVKP_Tj5MqbTnqwIw';

let map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/dark-v10',
    zoom: 7,
    center: [-120, 47]
});

let diplomaChart = null;
let breakpoints  = [];
let bins         = [];

const colors = ['#d73027', '#fc8d59', '#fee08b', '#91cf60', '#1a9850'];

function calEnrollment(data, bounds) {
    let total = 0, count = 0;
    data.features.forEach(f => {
        if (bounds.contains(f.geometry.coordinates)) {
            total += f.properties.TOTAL || 0;
            count++;
        }
    });
    return count > 0 ? total / count : 0;
}

function calBins(data, bounds) {
    let counts = [0, 0, 0, 0, 0];
    data.features.forEach(f => {
        if (bounds.contains(f.geometry.coordinates)) {
            let e = f.properties.TOTAL || 0;
            if      (e < breakpoints[0]) counts[0]++;
            else if (e < breakpoints[1]) counts[1]++;
            else if (e < breakpoints[2]) counts[2]++;
            else if (e < breakpoints[3]) counts[3]++;
            else                         counts[4]++;
        }
    });
    return counts;
}

async function geojsonFetch() {
    let response = await fetch('assets/wa_schools.geojson');
    let data = await response.json();

    // compute quantile breakpoints from full dataset
    const values = data.features
        .map(f => f.properties.TOTAL)
        .filter(v => v > 0)
        .sort((a, b) => a - b);

    breakpoints = [0.2, 0.4, 0.6, 0.8].map(q =>
        values[Math.floor(q * values.length)]
    );

    bins = [
        `<${breakpoints[0]}`,
        `${breakpoints[0]}–${breakpoints[1]}`,
        `${breakpoints[1]}–${breakpoints[2]}`,
        `${breakpoints[2]}–${breakpoints[3]}`,
        `${breakpoints[3]}+`
    ];

    // build legend
    const legend = document.getElementById('legend');
    let labels = ['<strong>Enrollment (Students)</strong>'];
    bins.forEach((bin, i) => {
        labels.push(`<p class="break">
            <i class="box" style="background:${colors[i]};"></i>
            <span class="box-label">${bin}</span>
        </p>`);
    });
    legend.innerHTML = labels.join('') +
        '<p style="text-align:right;font-size:10pt">Source: NCES 2022-23</p>';

    // snapshot into plain numbers for Mapbox
    const bp = [...breakpoints];

    map.on('load', () => {
        map.addSource('schools', { type: 'geojson', data: data });

        map.addLayer({
            'id': 'schools-layer',
            'type': 'circle',
            'source': 'schools',
            'paint': {
                'circle-radius': [
                    'interpolate', ['linear'], ['get', 'TOTAL'],
                    0,      4,
                    bp[1],  8,
                    bp[2],  12,
                    bp[3],  18
                ],
                'circle-color': [
                    'step', ['get', 'TOTAL'],
                    colors[0], bp[0],
                    colors[1], bp[1],
                    colors[2], bp[2],
                    colors[3], bp[3],
                    colors[4]
                ],
                'circle-opacity': 0.75
            }
        });

        // hover popup
        let hoverPopup = null;
        map.on('mousemove', 'schools-layer', (e) => {
            map.getCanvas().style.cursor = 'pointer';
            if (hoverPopup) hoverPopup.remove();
            const p = e.features[0].properties;
            hoverPopup = new mapboxgl.Popup({ closeButton: false })
                .setLngLat(e.lngLat)
                .setHTML(`<strong>${p.SCH_NAME}</strong><br>
                          Enrollment: ${p.TOTAL}<br>
                          Level: ${p.SCHOOL_LEVEL}`)
                .addTo(map);
        });
        map.on('mouseleave', 'schools-layer', () => {
            map.getCanvas().style.cursor = '';
            if (hoverPopup) { hoverPopup.remove(); hoverPopup = null; }
        });

        // click popup
        let clickPopup = null;
        map.on('click', 'schools-layer', (e) => {
            if (clickPopup) clickPopup.remove();
            const p = e.features[0].properties;
            clickPopup = new mapboxgl.Popup()
                .setLngLat(e.lngLat)
                .setHTML(`<strong>${p.SCH_NAME}</strong><br>
                          Enrollment: ${p.TOTAL}<br>
                          Level: ${p.SCHOOL_LEVEL}<br>
                          Address: ${p.LSTREET1}, ${p.LCITY}, ${p.LSTATE}<br>
                          District: ${p.LEA_NAME}`)
                .addTo(map);
        });

        // generate chart on initial load
        document.getElementById('diploma-avg').innerHTML =
            calEnrollment(data, map.getBounds()).toFixed(0);

        diplomaChart = c3.generate({
            size: { height: 300, width: 450 },
            data: {
                x: 'bin',
                columns: [
                    ['bin', ...bins],
                    ['#',   ...calBins(data, map.getBounds())]
                ],
                type: 'bar',
                colors: { '#': d => colors[d.x] }
            },
            axis: {
                x: { type: 'category' },
                y: { label: { text: 'Schools', position: 'outer-middle' } }
            },
            legend: { show: false },
            bindto: '#diploma-chart'
        });
    });

    // update stats and chart on every map move
    map.on('idle', () => {
        document.getElementById('diploma-avg').innerHTML =
            calEnrollment(data, map.getBounds()).toFixed(0);

        diplomaChart.load({
            columns: [
                ['bin', ...bins],
                ['#',   ...calBins(data, map.getBounds())]
            ]
        });
    });
}

geojsonFetch();

document.getElementById('reset').addEventListener('click', () => {
    map.flyTo({ zoom: 7, center: [-120, 47] });
});
