'use strict';



const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const deleteAllBtn = document.querySelector('.delete__button');
const sortBtn = document.querySelector('.icon_sort');
const sortField = document.querySelector('.sort__select');
const sidebarEl = document.querySelector('.sidebar');
const mapBlock = document.querySelector('#map');
const popup = document.querySelector('.popup');
//storage architecture
class Workout {
    date = new Date();
    id = (Date.now() + '').slice(-10);
    clicks = 0;
    constructor(coords, distance, duration) {
        this.coords = coords; // [lat, long]
        this.distance = distance; // km
        this.duration = duration; // hrs
    }
    _setDescription() {
        // prettier-ignore
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${months[this.date.getMonth()]} ${this.date.getDate()}`;
    }
    click() {
        this.clicks++;
    }
}
class Running extends Workout {
    type = 'running';
    constructor(coords, distance, duration, cadence) {
        super(coords, distance, duration);
        this.cadence = cadence;
        this.calcPace();
        this._setDescription();
    }

    calcPace() {
        this.pace = this.duration / this.distance;
        return this.pace;
    }
}
class Cycling extends Workout {
    type = 'cycling';
    constructor(coords, distance, duration, elevationGain) {
        super(coords, distance, duration);
        this.elevationGain = elevationGain;
        this.calcSpeed();
        this._setDescription();
    }
    calcSpeed() {
        this.speed = this.distance / (this.duration / 60);
        return this.speed;
    }
}
// const run1 = new Running([39, -12], 5.2, 24, 178);
// const cycle1 = new Cycling([39, -12], 27, 95, 523);
// console.log(run1, cycle1);

//////////////////////////////////////////////
//app architecture
class App {
    #map;
    #mapEvent;
    #workouts = [];
    #mapZoom = 13;
    #isSorted = false;
    constructor() {
        // get user's position
        this._getPosition();

        //get data from local storage
        this._getLocalStorage();
        
        // Attach event handlers
        form.addEventListener('submit', this._newWorkout.bind(this));
        inputType.addEventListener('change', this._toggleElevationField);
        containerWorkouts.addEventListener('click',this._moveToPopup.bind(this));
        deleteAllBtn.addEventListener('click', this.reset);
        sortBtn.addEventListener('click', this._sortWorkouts.bind(this));
    }
    _sortWorkouts() {
        const field = sortField.value;
        this.#workouts.sort((a, b) => a[field] - b[field]);
        const lists = document.querySelectorAll('.workout');
        lists.forEach(list => list.remove());
        this.#workouts.forEach(w => {
            this._renderWorkout(w);
        })
    }
    _getPosition() {
        if(navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
            this._loadMap.bind(this)
            , function() {
                        alert('Could not get your position!')
            })
        }
    }

    _loadMap(position) {
            const {latitude} = position.coords;
            const {longitude} = position.coords;
            const coords = [latitude, longitude];
            if(!this.#workouts[0]) {
                this.#map = L.map('map').setView(coords, this.#mapZoom);
            } else {
                const corner1 = L.latLng(this.#workouts[0].coords[0], this.#workouts[0].coords[1]);
                const corner2 = L.latLng(this.#workouts[this.#workouts.length - 1].coords[0], this.#workouts[this.#workouts.length - 1].coords[1])
                const bounds = L.latLngBounds(corner1, corner2);
                this.#map = L.map('map').fitBounds(bounds);
            }
            L.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(this.#map);
            this.#map.on('click', this._showForm.bind(this));
            this.#workouts.forEach(w => {
                this._renderWorkoutMarker(w);
            })
    }

    _showForm(mapE) {
            this.#mapEvent = mapE;
            form.classList.remove('hidden');
            inputDistance.focus();
    }
    _hideForm() {
        //empty the inputs
        inputCadence.value = inputDistance.value = inputDuration.value = inputElevation.value = '';
        form.style.display = 'none';
        form.classList.add('hidden');
        setTimeout(() => {
            form.style.display = 'grid'
        }, 1000);
    }
    _toggleElevationField() {
            inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
            inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
    }

    _newWorkout(e) {
        e.preventDefault();
        const validInputs = (...inputs) => inputs.every(i => Number.isFinite(i));
        const positiveInputs = (...inputs) => inputs.every(i => i > 0);
        // Get data from the form
        const type = inputType.value;
        const distance = +inputDistance.value;
        const duration = +inputDuration.value;

        //check if data is valid
        let workout;
        //if running create running object
        const {lat, lng} = this.#mapEvent.latlng;
        if(type === 'running') {
            const cadence = +inputCadence.value;
            if(!validInputs(distance, duration, cadence) || !positiveInputs(distance, duration, cadence)) return this._showPopup()
            workout = new Running([lat, lng], distance, duration, cadence);
        }
        //if cycling create cycling object
        if(type === 'cycling') {
            const elevation = +inputElevation.value;
            if(!validInputs(distance, duration, elevation) || !positiveInputs(distance, duration)) return this._showPopup()
            workout = new Cycling([lat, lng], distance, duration, elevation);
        }
        //add object to array
        this.#workouts.push(workout);
        //render workout on the map
        this._renderWorkoutMarker(workout);
        //render workout on list
        this._renderWorkout(workout);
        //hide form + clear input fields
        this._hideForm();
        
        // set local storage to all workouts
        this._setLocalStorage();
            
    }
    _showPopup() {
        popup.classList.remove('popup_hidden');
        popup.style.display = 'flex';
        mapBlock.classList.add('layer');
        mapBlock.classList.add('blured');
        sidebarEl.classList.add('blured');
        document.querySelector('.popup__button').addEventListener('click', this._hidePopup);
        setTimeout(this._hidePopup, 3000);
    }
    _hidePopup() {
        popup.classList.add('popup_hidden');
        popup.style.display = 'none';
        mapBlock.classList.remove('layer');
        mapBlock.classList.remove('blured');
        sidebarEl.classList.remove('blured');
    }
    _renderWorkoutMarker(workout) {
        L.marker(workout.coords)
            .addTo(this.#map)
            .bindPopup(L.popup({
                maxWidth: 250,
                minWidth: 100,
                autoClose: false,
                closeOnClick: false,
                className: `${workout.type}-popup`
            }))
            .setPopupContent(`${workout.type === "running" ? "🏃‍♂️" : "🚴‍♀️"} ${workout.description}`)
            .openPopup();
    }
    _renderWorkout(workout) {
        let html = `
            <li class="workout workout--${workout.type}" data-id="${workout.id}">
            <h2 class="workout__title">${workout.description}</h2>
            <div class="workout__flex">
            <div class="workout__details">
                <span class="workout__icon">${workout.type === "running" ? "🏃‍♂️" : "🚴‍♀️"}</span>
                <span class="workout__value">${workout.distance}</span>
                <input class="workout__input input_distance input_hidden" type="number" value=${workout.distance} />
                <span class="workout__unit">km</span>
            </div>
            <div class="workout__details">
                <span class="workout__icon">⏱</span>
                <span class="workout__value">${workout.duration}</span>
                <input class="workout__input input_duration input_hidden" type="number" value=${workout.duration} />
                <span class="workout__unit">min</span>
            </div>
        `;
        if(workout.type === 'running') {
            html += `
            <div class="workout__details">
                <span class="workout__icon">⚡️</span>
                <span class="workout__value">${workout.pace.toFixed(1)}</span>
                <input class="workout__input input_pace input_hidden" type="number" value=${workout.pace.toFixed(1)} />
                <span class="workout__unit">min/km</span>
            </div>
            <div class="workout__details">
                <span class="workout__icon">🦶🏼</span>
                <span class="workout__value">${workout.cadence}</span>
                <input class="workout__input input_cadence input_hidden" type="number" value=${workout.cadence} />
                <span class="workout__unit">spm</span>
            </div>
            <img src="./tick.svg.png" alt="tick" class="icon icon_tick icon_hidden" />
            </div>
            <div class="btn__container">
            <img src="./delete.png" alt="delete" class="icon icon_delete" />
            <img src="./edit.svg.png" alt="edit" class="icon icon_edit" />
            </div>
        </li>`;
        }
        if(workout.type === 'cycling') {
            html += `
            <div class="workout__details">
                <span class="workout__icon">⚡️</span>
                <span class="workout__value">${workout.speed.toFixed(1)}</span>
                <input class="workout__input input_speed input_hidden" type="number" value=${workout.speed.toFixed(1)} />
                <span class="workout__unit">km/h</span>
            </div>
            <div class="workout__details">
                <span class="workout__icon">⛰</span>
                <span class="workout__value">${workout.elevationGain}</span>
                <input class="workout__input input_elevation input_hidden" type="number" value=${workout.elevationGain} />
                <span class="workout__unit">m</span>
            </div>
            <img src="./tick.svg.png" alt="tick" class="icon icon_tick icon_hidden" />
            </div>
            <div class="btn__container">
            <img src="./delete.png" alt="delete" class="icon icon_delete" />
            <img src="./edit.svg.png" alt="edit" class="icon icon_edit" />
            </div>
        </li>
            `
        }
        form.insertAdjacentHTML('afterend', html);
    }
    _moveToPopup(e) {
        const workoutEl = e.target.closest('.workout');
        if(!workoutEl) return;
        const workout = this.#workouts.find(w => w.id === workoutEl.dataset.id);
        console.log(workout);
        if(e.target.classList.contains('icon_delete')) {
            this._deleteWorkout(workout);   
        }
        if(e.target.classList.contains('icon_edit')) {
            this._editWorkout(workoutEl, workout);
        }
        this.#map.setView(workout.coords, this.#mapZoom, {
            animate: true,
            pan: {
                duration: 1
            }
        });
        //use click method
        // workout.click();
    }
    _setLocalStorage() {
        localStorage.setItem('workouts', JSON.stringify(this.#workouts));
    }
    _getLocalStorage() {
        const data = JSON.parse(localStorage.getItem('workouts'));
        if(!data) return;
        this.#workouts = data;
        this.#workouts.forEach(w => {
            const id = w.id;
            if(w.type === 'running') {
                w = new Running(w.coords, w.distance, w.duration, w.cadence);
                w.id = id;
            }
            if(w.type === 'cycling') {
                w = new Cycling(w.coords, w.distance, w.duration, w.elevationGain);
                w.id = id;
            }
            this._renderWorkout(w);
        })
    }
    _deleteWorkout(workout) {
        const index = this.#workouts.indexOf(workout);
        this.#workouts.splice(index, 1);
        this._setLocalStorage();
        location.reload();
        return;
    }
    _editWorkout(workoutEl, workout) {
        const textElements = workoutEl.querySelectorAll('.workout__value');
        const inputElements = workoutEl.querySelectorAll('.workout__input');
        const tickBtn = document.querySelectorAll('.icon_tick');
        const changeValue = function() {
            const index = this.#workouts.indexOf(workout);
            this.#workouts[index].distance = workoutEl.querySelector('.input_distance').value;
            this.#workouts[index].duration = workoutEl.querySelector('.input_duration').value;
            if(workout.type === 'running') {
                this.#workouts[index].pace = +workoutEl.querySelector('.input_pace').value;
                this.#workouts[index].cadence = workoutEl.querySelector('.input_cadence').value;
            }
            if(workout.type === 'cycling') {
                this.#workouts[index].speed = +workoutEl.querySelector('.input_speed').value;
                this.#workouts[index].elevationGain = workoutEl.querySelector('.input_elevation').value;
            }
            this._setLocalStorage();
            location.reload();
        }
        tickBtn.forEach(btn => {
            if(btn.closest('.workout') === workoutEl) {
                btn.classList.remove('icon_hidden');
                btn.addEventListener('click', changeValue.bind(this));
            }
        })
        textElements.forEach(el => el.classList.add('workout_hidden'));
        inputElements.forEach(el => el.classList.remove('input_hidden'));
    }
    reset() {
        localStorage.removeItem('workouts');
        location.reload();
    }
}
const app = new App();

