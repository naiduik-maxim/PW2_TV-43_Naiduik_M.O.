const limits = [
    {min: 180, max: 260, normMin: 210, normMax: 240, isInt: false}, // 0: Напруга входу
    {min: 220, max: 230, normMin: 223, normMax: 227, isInt: false}, // 1: Напруга виходу
    {min: 0,   max: 100, normMin: 30,  normMax: 80,  isInt: true},  // 2: Навантаження
    {min: 0,   max: 100, normMin: 90,  normMax: 100, isInt: true},  // 3: Заряд батареї
    {min: 48,  max: 52,  normMin: 49.5,normMax: 50.5,isInt: false}, // 4: Частота виходу
    {min: 10,  max: 60,  normMin: 20,  normMax: 40,  isInt: true}   // 5: Температура
];

let autoInterval;
let isAuto = false;
let history = [];
let upsChart;

/**
 * Відтворює звуковий сигнал тривоги.
 * 
 * якщо хоча б один із параметрів досягає критичного значення.
 */
function playCriticalSound() {
    try {
        const alarmSound = new Audio('sound.mp3');
        alarmSound.play();
    } catch (e) {
        console.error("Помилка відтворення файлу sound.mp3", e);
    }
}

/**
 * Імітує отримання даних з датчиків.
 * Проходить по масиву limits і генерує випадкові значення для кожного параметра 
 * в межах заданих мінімумів та максимумів.
 */
function generateSensorData() {
    let numericData = limits.map(param => {
        const margin = (param.max - param.min) * 0.2;
        let val = Math.random() * ((param.max + margin) - (param.min - margin)) + (param.min - margin);
        if (param.isInt && val < 0) val = 0;
        return param.isInt ? Math.round(val) : parseFloat(val.toFixed(1));
    });

    const modes = ['Мережа', 'Батарея', 'Bypass']; 
    const randomMode = modes[Math.floor(Math.random() * modes.length)];

    return {
        numeric: numericData,
        mode: randomMode
    };
}

/**
 * Визначає поточний статус параметра на основі його значення.
 * Повертає 'normal' (норма), 'warning' (увага) або 'critical' (критично),
 * порівнюючи значення із заданими лімітами.
 */
function checkStatus(value, limitsObj) {
    if (value >= limitsObj.normMin && value <= limitsObj.normMax) return 'normal';
    if (value >= limitsObj.min && value <= limitsObj.max) return 'warning';
    return 'critical';
}

/**
 * Повертає поточний час у форматі рядка.
 * Використовує українську локаль ('uk-UA') для форматування часу (наприклад, 14:30:15).
 */
function formatTimestamp() {
    return new Date().toLocaleTimeString('uk-UA');
}

/**
 * Оновлює інтерфейс користувача (DOM) новими даними.
 * Виводить значення на екран, змінює колір та текст індикаторів статусу, 
 * запускає звуковий сигнал у разі критичної ситуації та додає нові дані на графік Chart.js.
 */
function updateDisplay(data) {
    let isCritical = false;

    data.numeric.forEach((val, idx) => {
        document.getElementById(`param${idx}`).textContent = val;
        const status = checkStatus(val, limits[idx]);
        const indicator = document.getElementById(`status${idx}`);

        if (status === 'normal') {
            indicator.className = 'status-indicator status-normal';
            indicator.textContent = '✅ Норма';
        } else if (status === 'warning') {
            indicator.className = 'status-indicator status-warning';
            indicator.textContent = '⚠️ Увага';
        } else {
            indicator.className = 'status-indicator status-danger';
            indicator.textContent = '🚨 Критично';
            isCritical = true;
        }
    });

    const modeElem = document.getElementById('paramMode');
    const modeStatus = document.getElementById('statusMode');
    modeElem.textContent = data.mode;
    
    if (data.mode === 'Мережа') {
        modeStatus.className = 'status-indicator status-normal';
        modeStatus.textContent = '✅ Норма';
    } else if (data.mode === 'Батарея') {
        modeStatus.className = 'status-indicator status-warning';
        modeStatus.textContent = '⚠️ Увага';
    } else {
        modeStatus.className = 'status-indicator status-danger';
        modeStatus.textContent = '🚨 Критично';
        isCritical = true;
    }

    const currentTime = formatTimestamp();
    document.getElementById('lastUpdate').textContent = currentTime;

    if (isCritical) {
        playCriticalSound();
    }

    if (upsChart) {
        upsChart.data.labels.push(currentTime);
        upsChart.data.datasets[0].data.push(data.numeric[2]); // Навантаження
        upsChart.data.datasets[1].data.push(data.numeric[3]); // Батарея

        if (upsChart.data.labels.length > 15) {
            upsChart.data.labels.shift();
            upsChart.data.datasets[0].data.shift();
            upsChart.data.datasets[1].data.shift();
        }
        upsChart.update();
    }
}

/**
 * Зберігає отримані дані в історію та локальне сховище браузера.
 * Формує об'єкт із поточними показниками, додає його в масив history (максимум 50 записів)
 * і записує оновлений масив у localStorage, щоб дані не втрачалися після перезавантаження.
 */
function saveData(data) {
    const record = {
        time: formatTimestamp(),
        vin: data.numeric[0],
        vout: data.numeric[1],
        load: data.numeric[2],
        battery: data.numeric[3],
        freq: data.numeric[4],
        temp: data.numeric[5],
        mode: data.mode
    };
    history.push(record);
    
    if (history.length > 50) history.shift();
    
    localStorage.setItem('upsHistory', JSON.stringify(history));
}

/**
 * Виконує цикл ручного оновлення.
 * Генерує нові випадкові дані, оновлює відображення на сторінці та зберігає дані в історію.
 */
function manualUpdate() {
    const newData = generateSensorData();
    updateDisplay(newData);
    saveData(newData);
}

/**
 * Керує автоматичним оновленням даних.
 * Вмикає (кожні 5 секунд) або вимикає циклічний виклик функції manualUpdate(),
 * а також змінює вигляд кнопки та текстового статусу в інтерфейсі.
 */
function autoUpdate() {
    const btn = document.getElementById('autoUpdate');
    const statusText = document.getElementById('autoStatus');
    
    if (!isAuto) {
        autoInterval = setInterval(manualUpdate, 10000);
        isAuto = true;
        btn.innerHTML = '⏸️ Зупинити';
        btn.className = 'btn btn-danger';
        statusText.textContent = 'Статус: 🟢 Увімкнено (10с)';
    } else {
        clearInterval(autoInterval);
        isAuto = false;
        btn.innerHTML = '▶️ Автооновлення';
        btn.className = 'btn btn-success';
        statusText.textContent = 'Статус: 🔴 Вимкнено';
    }
}

/**
 * Експортує накопичені дані у форматі CSV.
 * Формує текстовий рядок з усіма збереженими показниками та автоматично
 * створює і завантажує файл 'history.csv' на комп'ютер користувача.
 */
function exportCSV() {
    if (history.length === 0) {
        alert("Немає даних для експорту!");
        return;
    }
    
    let csvContent = "data:text/csv;charset=utf-8,Час,Вхідна Напруга (В),Вихідна Напруга (В),Навантаження (%),Заряд батареї (%),Частота (Гц),Температура (°C),Режим\n";
    
    history.forEach(row => {
        csvContent += `${row.time},${row.vin},${row.vout},${row.load},${row.battery},${row.freq},${row.temp},${row.mode}\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "history.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Ініціалізує графік (Chart.js) при завантаженні сторінки.
 * Налаштовує лінії для відображення "Навантаження" та "Заряду батареї", 
 * встановлює кольори, тип графіку та параметри адаптивності.
 */
function initChart() {
    const ctx = document.getElementById('upsChart').getContext('2d');
    upsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Навантаження (%)',
                    data: [],
                    borderColor: '#f39c12',
                    tension: 0.3,
                    fill: false
                },
                {
                    label: 'Заряд батареї (%)',
                    data: [],
                    borderColor: '#2ecc71',
                    tension: 0.3,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, max: 120 }
            }
        }
    });
}

// Подія, що спрацьовує після повного завантаження DOM (HTML сторінки)
document.addEventListener('DOMContentLoaded', () => {
    initChart();
    
    const stored = localStorage.getItem('upsHistory');
    if (stored) {
        history = JSON.parse(stored);
        history.forEach(record => {
            upsChart.data.labels.push(record.time);
            upsChart.data.datasets[0].data.push(record.load);
            upsChart.data.datasets[1].data.push(record.battery);
        });
        if (upsChart.data.labels.length > 15) {
            upsChart.data.labels = upsChart.data.labels.slice(-15);
            upsChart.data.datasets[0].data = upsChart.data.datasets[0].data.slice(-15);
            upsChart.data.datasets[1].data = upsChart.data.datasets[1].data.slice(-15);
        }
        upsChart.update();
    }
    
    manualUpdate();
});