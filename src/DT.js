export const DT = (() => {
	const locale = {
		weekdays: {
			shorthand: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
			longhand: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'],
		},
		months: {
			shorthand: ['Янв', 'Фев', 'Март', 'Апр', 'Май', 'Июнь', 'Июль', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
			longhand: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
			parental: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
				'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
		},
		rangeSeparator: ' — ',
	};

	const ruUnits = {
		'год': 'Y',
		'календарный день': 'd',
		'квартал': 'Q',
		'месяц': 'M',
		'неделя': 'w',
		'рабочий день': 'workingDay',
	};

	var _t = {};

	_t.initNonWorking = () => {
		_t.WorkingWeekdays = [1, 2, 3, 4, 5];
		_t.NonWorkingDates = [];
	};

	_t.locale = locale;

	// _t.TimeZone = context.UserId ? getUserDetails(context.UserId).TimeZone.IanaId : null;
	_t.WorkingSatSun = []; // рабочие сб, вс
	_t.WorkingWeekdays = null;
	_t.NonWorkingDates = null;

	// форматы представления дат
	// d - день, m - месяц, Y - год, H - часы, i - минуты, S - секунды
	_t.D_STD = 'd.m.Y';
	_t.T_STD = 'H:i';
	_t.D_SQL = 'Y-m-d';
	_t.T_SQL = 'H:i:S';
	_t.DT_STD = _t.D_STD + ' ' + _t.T_STD;
	_t.DT_SQL = _t.D_SQL + ' ' + _t.T_SQL;
	/**
		 * Проверка, является ли сущность датой
		 * @param {Date|String} d
		 * @returns {Boolean}
		 */
	// "01.01.0001 0:00:00" исключать такие
	_t.is = d => {

		const rx_d = /^\d{1,4}([-/.])\d{1,2}\1\d{1,4}$/;
		const rx_t = /^\d{1,2}:\d{1,2}(:\d{1,2}(\.\d+Z?)?)?(\+\d{1,2}:\d{1,2})?$/;
		const rx_dt = /^\d{1,4}([-/.])\d{1,2}\1\d{1,4}.\d{1,2}:\d{1,2}(:\d{1,2}(\.\d+Z?)?)?(\+\d{1,2}:\d{1,2})?$/;

		return Boolean(
			d instanceof Date ||
			(d && (
				rx_d.test(d)
				|| rx_t.test(d)
				|| rx_dt.test(d)
			))
		);
	};
	/**
	 * Добавление времени
	 * @param {Date|String} input_dt изначальная дата/время
	 * @param {Number} add количество добавляемых единиц
	 * @param {String} unit добавляемая единица
	 * (M - месяц, s - секунда, m - минута, h - час, d - день)
	 * @param {String} format формат вывода даты
	 * @returns {String} новое время в нужном формате
	 */
	_t.add = (input_dt, add, unit, format = '') => {
		if (ruUnits[unit]) {
			unit = ruUnits[unit];
		}

		if (unit === 'workingDay') {
			return _t.addWorkingDays(add, input_dt, format);
		}

		if (!format) { // TODO: дублируется в коде
			// выдача только даты, если подразумевается только дата
			format = input_dt.includes(':') || ['s', 'm', 'h'].includes(unit) ? _t.DT_SQL : _t.D_SQL;
		}
		let ms = +_t.format(input_dt, 'U') * 1000;

		if (add) {
			if (['M', 'Q', 'Y'].includes(unit)) {
				ms = new Date(ms);

				ms = unit === 'Y'
					? ms.setFullYear(ms.getFullYear() + add)
					: ms.setMonth(ms.getMonth() + add * (unit === 'Q' ? 3 : 1));
			} else {
				const multi = {
					s: 1000, m: 60000, h: 3600000, d: 86400000, w: 7 * 86400000,
				}, m = multi[unit];

				if (!m) throw new Error(`Неверный множитель даты: "${unit}"`);
				ms += add * m;
			}
		}

		return _t.format(new Date(ms), format);
	};

	_t.isWorkingDay = input_dt => {
		if (!_t.WorkingWeekdays) _t.initNonWorking();

		return (
			(~_t.WorkingWeekdays.indexOf(_t.format(input_dt, 'w')) && !~_t.NonWorkingDates.indexOf(input_dt)) ||
			~_t.WorkingSatSun.indexOf(input_dt)
		);
	};
	/**
	 * Добавление к дате рабочих дней.
	 * Рабочие дни указываются во вкладке Аккаунт в Case.One
	 * @param {Number} add Количество добавляемых рабочих дней
	 * если add === 0 - возвращает ближайший рабочий день
	 * @param {Date|String} input_dt Начальная дата
	 * @returns {String} Дата в формате 'Y-m-d'
	 */
	_t.addWorkingDays = (add, input_dt = _t.curdate, format = null) => {
		if (!_t.WorkingWeekdays) _t.initNonWorking();

		add = Math.round(add);

		const working = input_dt =>
			(~_t.WorkingWeekdays.indexOf(_t.format(input_dt, 'w')) && !~_t.NonWorkingDates.indexOf(input_dt)) ||
			~_t.WorkingSatSun.indexOf(input_dt);

		format = format || (input_dt.includes(':') ? _t.DT_SQL : _t.D_SQL);
		input_dt = _t.format(input_dt, format);

		if (!add) {
			// если рабочий, то вернёт текущий день
			add = 1; // иначе, первый следующий рабочий
			while (!working(input_dt)) {
				input_dt = _t.add(input_dt, add, 'd', _t.D_SQL);
			}
			return input_dt;
		}

		let inc = add >= 0 ? 1 : -1,
			safety = 999;

		input_dt = _t.add(input_dt, inc, 'd', format); // не учитываем текущий день

		while (--safety) {
			if (!safety) throw new Error(`Зациклился DT.addWorkingDays для ${input_dt} + ${add}`);

			working(input_dt) && (add += -1 * inc);

			if (!add) break;

			input_dt = _t.add(input_dt, inc, 'd', format);
		}

		return input_dt;
	};
	/**
	 * Вычисление разницы между датами в днях
	 * @param {Date|String} dt1 Дата 1
	 * @param {Date|String} dt0 Дата 2
	 * @returns {Number} Разница между датами в днях
	 */
	_t.diffD = (dt1, dt0) => {
		return Math.round((_t.format(dt1, 'U') - _t.format(dt0, 'U')) / 86400000);
	};
	/**
	 * Вычисление разницы между датами в минутах
	 * @param {Date|String} dt1 Дата 1
	 * @param {Date|String} dt0 Дата 2
	 * @returns {Number} Разница между датами в минутах
	 */
	_t.diffM = (dt1, dt0) => {
		return Math.round((_t.format(dt1, 'U') - _t.format(dt0, 'U')) / 60000);
	};
	/**
	 * Вычисление разницы между датами в секундах
	 * @param {Date|String} dt1 Дата 1
	 * @param {Date|String} dt0 Дата 2
	 * @returns {Number} Разница между датами в секундах
	 */
	_t.diffSec = (dt1, dt0) => {
		return Math.round((_t.format(dt1, 'U') - _t.format(dt0, 'U')) / 1000);
	};
	/**
	 * Вычисляет, сколько времени прошло с введённой даты (до настоящего момента)
	 * @param {Date|String} input_dt
	 * @returns {String} Возвращает прошедшее время в человекочитаемом формате
	 */
	_t.fromNow = input_dt => {
		let ms = Date.now() - _t.format(input_dt, 'U'),
			r = '';

		switch (true) {
			case ms < 60000:
				return 'только что';
			case ms < 3600000:
				r = Math.round(ms / 60000, 'i') + ' мин.';
				break;
			default:
				r = Math.round(ms / 3600000, 'H') + ' ч.';
		}

		return r + ' назад';
	};

	_t.addRoundMonths = (input_dt, add) => {
		function isLeapYear(year) {
			return (((year % 4 === 0) && (year % 100 !== 0)) || (year % 400 === 0));
		}
		function getDaysInMonth(year, month) {
			return [31, (isLeapYear(year) ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month];
		}

		const tmp = new Date(input_dt);
		const n = tmp.getDate();
		tmp.setDate(1);
		tmp.setMonth(tmp.getMonth() + add);

		// установка последнего дня месяца в случае отсутствия дня(например в феврале)
		tmp.setDate(Math.min(n, getDaysInMonth(tmp.getFullYear(), tmp.getMonth())));
		return _t.format(tmp, _t.D_SQL);
	};

	/**
	 * Форматирование даты
	 * @param {Date|String} input_dt Входная дата в любом формате
	 * @param {String} format Формат даты.
	 * (Можно использовать константы выше (D_STD, D_STD, T_STD, D_SQL, T_SQL, DT_STD, DT_SQL)
	 * или написать самому - https://flatpickr.js.org/formatting/)
	 * @returns {Number|String} Если формат простой (1 символ) -
	 * то возвращается число или строка, иначе - строка
	 */
	_t.format = (input_dt, format = '') => {
		if (!input_dt) return '';
		let dt;
		if (input_dt instanceof Date) {
			dt = input_dt;
		} else if (typeof input_dt === 'number') {
			dt = new Date(input_dt);
		} else {
			if (typeof input_dt === 'object') {
				throw new Error('Некорректное значение на входе DT.format - ' + JSON.stringify(input_dt));
			}

			!format && input_dt.includes(':') && (format = _t.DT_SQL);

			// необходимо перевести русскую дату в sql-ную, иначе Date добавит 3 часа часового пояса!
			input_dt = input_dt.replace(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/, '$3-$2-$1');

			// для macos, которые не понимают пробела между датой и временем
			input_dt.match(/^\d+-\d+-\d+\s/)
				&& (input_dt = input_dt.replace(' ', 'T'));
			dt = _t.is(input_dt) ? new Date(input_dt) : new Date();

			// Invalid Date
			if (isNaN(dt)) return '';

			// если дата без времени - ставим время на полночь
			input_dt.includes(':') || dt.setHours(0, 0, 0, 0);
		}

		if (format === 'UTC') {
			return dt.toISOString();
		}

		format || (format = _t.D_SQL);

		let length = format.length,
			i = -1,
			r = '';

		// if (dt.getTimezoneOffset() && (dt.getHours() + dt.getMinutes() + dt.getSeconds())) {
		// 	dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
		// }

		while (++i < length) {
			const f = format[i];
			let d = f;
			switch (f) {
				case 'd': case 'j': //case 'J' // 1st 2nd 3rd
					d = dt.getDate();
					d < 10 && f === 'd' && (d = '0' + d);
					break;
				case 'D': case 'l': case 'w':
					d = dt.getDay();
					if (f === 'l') {
						d = locale.weekdays.longhand[d];
					} else if (f === 'D') {
						d = locale.weekdays.shorthand[d];
					}
					break;
				// case 'W': // 0..52
				case 'F': case 'f': case 'M': case 'm': case 'n':
					d = dt.getMonth();
					if (f === 'F') {
						d = locale.months.longhand[d];
					} else if (f === 'f') {
						d = locale.months.parental[d];
					} else if (f === 'M') {
						d = locale.months.shorthand[d];
					} else {
						d++;
						d < 10 && f === 'm' && (d = '0' + d);
					}
					break;
				case 'y': case 'Y':
					d = dt.getFullYear();
					f === 'y' && (d = String(d).slice(2));
					break;
				case 'U':
					d = Math.floor(dt.getTime() / 1000);
					break;
				case 'H': case 'G': // case 'h': // 4 am
					d = dt.getHours();
					d < 10 && f === 'H' && (d = '0' + d);
					break;
				case 'i':
					d = dt.getMinutes();
					d < 10 && (d = '0' + d);
					break;
				case 'S': case 's':
					d = +dt.getSeconds();
					d < 10 && f === 'S' && (d = '0' + d);
					break;
				// case 'K': // AM/PM
			}

			// для сохранения типа данных, если формат простой
			if (f === format) return d;

			// иначе всегда строка
			r += d;
		}

		return r;
	};
	/**
	 * Возвращает текущую дату и время
	 * @param {String} format Формат вывода.
	 * (Можно использовать константы выше (D_STD, D_STD, T_STD, D_SQL, T_SQL, DT_STD, DT_SQL)
	 * или написать самому - https://flatpickr.js.org/formatting/)
	 * @returns {Number|String} Текущее время
	 */
	_t.now = format => _t.format(Date(), format || _t.D_SQL + ' ' + _t.T_SQL);
	/**
	 * Текущая дата в формате 'Y-m-d'
	 */
	_t.curdate = _t.format(new Date(), _t.D_SQL);
	/**
	 * Проверка года на високосность
	 * @param {Date|String|Number} input_dt Дата или отдельный год
	 * @returns {Boolean} Вискосный год или нет
	 */
	_t.isLeapYear = input_dt => {
		const dt = input_dt ? new Date(String(input_dt)) : new Date();
		const year = dt.getFullYear();
		return (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
	};

	_t.nextMonthXday = (date, day) => {
		date = _t.add(date, 1, 'M').split('-');
		date[2] = day;
		return _t.format(date.join('-'));
	};

	return _t;
})();