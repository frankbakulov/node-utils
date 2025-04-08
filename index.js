const colors = {
	red: 31,
	green: 32,
	yellow: 33,
	blue: 34,
	magenta: 35,
	cyan: 36,
	white: 37,
	gray: 90,
};
/* 
Reset = "\x1b[0m"
Bright = "\x1b[1m"
Dim = "\x1b[2m"
Underscore = "\x1b[4m"
Blink = "\x1b[5m"
Reverse = "\x1b[7m"
Hidden = "\x1b[8m"

FgBlack = "\x1b[30m"
FgMagenta = "\x1b[35m"
FgCyan = "\x1b[36m"
FgWhite = "\x1b[37m"

BgBlack = "\x1b[40m"
BgRed = "\x1b[41m"
BgGreen = "\x1b[42m"
BgYellow = "\x1b[43m"
BgBlue = "\x1b[44m"
BgMagenta = "\x1b[45m"
BgCyan = "\x1b[46m"
BgWhite = "\x1b[47m"
BgGray = "\x1b[100m"
*/

// вывод с именем файла и номером строки
// если существует папка logs, также запись в лог 
['debug', 'error'].forEach((methodName) => {
	const originalLoggingMethod = console[methodName];
	console[methodName] = (firstArgument, ...otherArguments) => {
		const originalPrepareStackTrace = Error.prepareStackTrace;
		Error.prepareStackTrace = (_, stack) => stack;
		const callee = new Error().stack[1];
		Error.prepareStackTrace = originalPrepareStackTrace;
		// const relativeFileName = path.relative(process.cwd(), callee.getFileName());
		const relativeFileName = callee.getFileName();
		const prefix = `${relativeFileName}:${callee.getLineNumber()}:`;

		fs.access('logs', err => {
			if (err) return;
			const txt = [firstArgument, ...otherArguments].map(a => typeof a === 'object' ? JSON.stringify(a, null, '\t') : a).join(' ');

			fs.appendFile(`logs/console-${methodName}.log`, `${(new Date).toLocaleString()} ${prefix}\n${txt}\n`, () => { });
		});

		if (typeof firstArgument === 'string') {
			originalLoggingMethod(prefix + ' ' + firstArgument, ...otherArguments);
		} else {
			originalLoggingMethod(prefix, firstArgument, ...otherArguments);
		}
	};
});

Object.keys(colors).forEach(c => {
	console[c] = function (...args) {
		args.map(x => this.log('\x1b[' + colors[c] + 'm%s\x1b[0m', x));
	};
});

import fs from 'fs';
import util from 'util';
import { DT } from './src/DT.js';

let ts = 0;
const cacheDir = '_cache/',
	deleteFolderRecursive = path => {
		let files = [];
		if (fs.existsSync(path)) {
			files = fs.readdirSync(path);
			files.forEach(function (file, index) {
				let curPath = path + "/" + file;
				if (fs.lstatSync(curPath).isDirectory()) { // recurse
					deleteFolderRecursive(curPath);
				} else { // delete file
					fs.unlinkSync(curPath);
				}
			});
			fs.rmdirSync(path);
		} else {
			console.log(`folder not exists: ${path}`);
		}
	},
	getKeyByValue = (obj, value) =>
		Object.keys(obj)[Object.values(obj).indexOf(value)],
	sanitizeFileName = filename => filename.replace(/[<>:"/\\|?*]/g, '_').replace(/[\u1000-\uFFFF]+/g, '').trim(),
	mkdir = dir => {
		try {
			fs.accessSync(dir, fs.constants.W_OK);
		} catch (e) {
			e.code === 'ENOENT' && fs.mkdirSync(dir, { recursive: true });
		}
	},
	deepAssign = (oMain, oNew) => {
		Object.keys(oNew).forEach(k => {
			if (isObject(oMain[k])) {
				oMain[k] = deepAssign(oMain[k], oNew[k]);
			} else {
				oMain[k] = oNew[k];
			}
		});

		return oMain;
	},
	toString = obj => {
		if (obj instanceof Date) {
			obj = DT.format(obj, DT.DT_SQL);
		} else if (typeof obj === 'object') {
			obj = JSON.stringify(obj);
		} else if (typeof obj === 'number') {
			obj = obj.toString();
		}

		return obj;
	},
	isObject = s => s && typeof s === 'object' && s.length === undefined,
	/**
	 * @description node:fetch wrapper. Always resolves with the following object
	 * @typedef {Object} httpResponse
	 * @property {number} statusCode - http status code; if negative then node:undici code
	 * @property {string} statusMessage
	 * @property {Object} [headers] - http response headers
	 * @property {string} [url] - http requested url
	 * @property {string} [body] - http response body
	 * 
	 * @returns {httpResponse}
	 * 
	 */
	_fetch = (url, options) => fetch(url, options).then(response => {
		let headers = {};
		for (const [k, v] of response.headers) {
			headers[k.toLowerCase()] = v;
		}

		let formattedResponse = {
			statusCode: response.status,
			statusMessage: response.statusText,
			headers,
			url: response.url,
			body: null
		};

		if (!response.body) return formattedResponse;

		const reader = response.body.getReader();
		let stream = new ReadableStream({
			start(controller) {
				// The following function handles each data chunk
				function push() {
					// "done" is a Boolean and value a "Uint8Array"
					reader.read().then(({ done, value }) => {
						// If there is no more data to read
						if (done) {
							controller.close();
							return;
						}
						// Get the data and send it to the browser via the controller
						controller.enqueue(value);
						// Check chunks by logging to the console
						push();
					});
				}

				push();
			}
		});

		let isBinary = formattedResponse.headers['content-transfer-encoding'] === 'binary'
			|| (!formattedResponse.headers['content-type'].match(/(te?xt|json|htm|xml)/));

		return isBinary
			? new Response(stream).arrayBuffer()
				.then(body => {
					formattedResponse.body = Buffer.from(body, 'binary');
					return formattedResponse;
				})
			: new Response(stream, { headers: { "Content-Type": "text/html" } }).text()
				.then(body => {
					formattedResponse.body = body;
					return formattedResponse;
				});
	}).catch(e => {
		return {
			statusCode: -e.code,
			statusMessage: e.message + ' ' + (e.cause || ''),
		};
	});

export default {
	DT,
	deepAssign,
	isObject,
	newv: () => console.log(exec(`node -v`)),
	deleteFolderRecursive,
	sanitizeFileName,
	getKeyByValue,
	/**
 * @description get keys with values that are different
 * @returns {[string]}
 */
	objectDifferentKeys: (o1, o2) => {
		var r = [];
		for (var [k1, v1] of Object.entries(o1)) {
			v1 === o2[k1] || r.push(k1);
		}
		return r.concat(Object.keys(o2).filter(k2 => o1[k2] === undefined));
	},
	eq: (v1, v2) => {
		if (!v1 && !v2) {
			return v1 === 0 && v2 === 0 || (v1 !== 0 && v2 !== 0);
		}

		if (Object.keys(v1).length != Object.keys(v2).length) return false;

		for (const k1 in v1) {
			if (isObject(v1[k1]) && isObject(v2[k1])) {
				if (!eq(v1[k1], v2[k1])) return false;
				continue;
			}
			if (v2[k1] === undefined || v1[k1] != v2[k1]) return false;
		}

		return true;
	},
	fetch: _fetch,
	match1: (rx, s) => (s.match(rx) || ['', ''])[1],
	mt: msg => {
		if (ts && typeof msg === 'string') {
			console.log(`${msg} ${String((Date.now() - ts) / 1000).padEnd(5, '0')}`);
		}

		if (typeof msg === 'object') {
			if (msg.ts) {
				return (`${msg.msg || ''} ${String((Date.now() - msg.ts) / 1000).padEnd(5, '0')}`.trim());
			}

			msg.ts = Date.now();
			return '';
		}

		ts = Date.now();
	},
	fileAge: (file) => DT.format(fs.statSync(file).mtimeMs / 1000, 'mds', 'U'),
	resolveObject(obj) {
		let ps = [];

		const
			resolveValues = obj => {
				if (Array.isArray(obj)) {
					obj.forEach((value, i) => resolveOne(value, i, obj));
				} else if (obj && typeof obj === 'object') {
					Object.keys(obj).forEach(key => resolveOne(obj[key], key, obj));
				}
			},
			resolveOne = (value, key, obj) => {
				if (value?.then) {
					ps.push(value.then(value => obj[key] = value));
				} else if (typeof value === 'object') {
					resolveValues(value);
				}
				return value;
			};

		resolveValues(obj);
		return Promise.all(ps).then(() => obj);
	},
	mkdir,
	readDir: dir => {
		mkdir(dir);
		return fs.readdirSync(dir);
	},
	flipName: runner => {
		let n = runner.name;
		runner.name = runner.surname;
		runner.surname = n;
	},
	grabUrl: async (url, useCache, isBinary, options) => {
		// TODO:
		// - title/filename Y.m.d-user-page.html
		// - 
		let fileUrl = cacheDir + sanitizeFileName(url);
		if (useCache && fs.existsSync(fileUrl)) {
			return fs.promises.readFile(fileUrl, 'utf8');
		}
		let r;
		try {
			r = await _fetch(url, deepAssign({
				headers: {
					Accept: `text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7`,
					'Cache-Control': 'no-cache',
					Pragma: 'no-cache',
					'Upgrade-Insecure-Requests': 1,
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
				}
			}, options));
		} catch (e) {
			throw new Error(e.config.url + ' ' + e.response.status + ' ' + e.response.statusText);
		}

		if (r.statusCode >= 200 && r.statusMessage < 300) {
			if (useCache) {
				mkdir(cacheDir);
				fs.writeFileSync(fileUrl, r.body);
			}
			return r.body;
		}

		throw new Error(url + ' ' + r.statusCode + ' ' + r.statusText);
	},
	millisecToHumanTime: sec => {
		const h = Math.floor(sec / 3600000),
			m = Math.floor((sec % 3600000) / 60000),
			s = Math.floor((sec % 60000) / 1000);
		return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	},
	columnToArray: (file, index = 0, separator = '\t') =>
		fs.readFileSync(file, 'utf-8').split('\n').map(line => line.split(separator)[index].trim()),
	/**
	 * finds non-consecutive files in dir
	 */
	findSpaces: DIR => {
		let nums = fs.readdirSync(DIR).map(n => +(n.match(/^(\d+)/) || [-1])[0]).filter(n => n >= 0);
		if (!nums.length) return;
		nums.sort((a, b) => a - b);
		let i = 0, spaces = [];
		while (nums[++i]) {
			if (nums[i] - nums[i - 1] != 1) {
				let d = nums[i - 1] + 1;
				do {
					spaces.push(d);
				} while (++d < nums[i]);
			}
		}
		return spaces;
	},
	getTimeDiff: (t0, t1) => {
		let d = new Date(t1) - new Date(t0),
			h = Math.floor(d / 3600000),
			m = Math.floor((d % 3600000) / 60000),
			s = Math.floor((d % 60000) / 1000);

		return [h, m, s].map(p => String(p).padStart(2, '0')).join(':');
	},
	delay: ms => new Promise(resolve => setTimeout(resolve, ms)),
	v: data => console.log(util.inspect(data, false, 999)),
	removeHTML: s => {
		if (s === 0) return s;
		if (!s) return '';

		s = String(s);
		const map = [
			// https://www.w3.org/wiki/Common_HTML_entities_used_for_typography
			['&cent;', '¢'],
			['&pound;', '£'],
			['&sect;', '§'],
			['&copy;', '©'],
			['&reg;', '®'],
			['&deg;', '°'],
			['&plusmn;', '±'],
			['&para;', '¶'],
			['&middot;', '·'],
			['&frac12;', '½'],
			['&ndash;', '–'],
			['&mdash;', '—'],
			['&sbquo;', '‚'],
			['&bdquo;', '„'],
			['&dagger;', '†'],
			['&bull;', '•'],
			['&prime;', '′'],
			['&Prime;', '″'],
			['&euro;', '€'],
			['&trade;', '™'],
			['&asymp;', '≈'],
			['&ne;', '≠'],
			['&le;', '≤'],
			['&ge;', '≥'],
			['&nbsp;', ' '],
			['&quot;', '"'],
			['&apos;', '\''],
			['&lt', '<'],
			['&gt', '>'],
			['&lang;', '<'],
			['&rang;', '>'],
			['&amp;', '&'],
			['&prime;', "'"],
			['&laquo;', '«'],
			['&raquo;', '»'],
			['&sim;', '~'],
			['&#8764;', '∼'],
			['&#43;', '+'],
			['&ldquo;', '“'],
			['&rdquo;', '”'],
			['&minus;', '-'],
			['&lowast;', '**'],
			['&hellip;', '…'],
			['&lsquo;', '‘'],
			['&larr;', '←'],
			['&uarr;', '↑'],
			['&rarr;', '→'],
			['&darr;', '↓'],
			['&rsquo;', '’'],
		];

		s = s.replace(/(<br\s*\/?>)/g, '\n');
		s = s.replace(/(<\/(li|p)\s*>)/g, '$1\n');
		s = s.replace(/<([a-zA-Z][^>]*|\/?[a-zA-Z]+[^>]*)>/g, '');

		map.forEach(ft => (s = s.replace(new RegExp(ft[0], 'gi'), ft[1])));

		return s;
	},
	millisecToHumanTime: sec => {
		const h = Math.floor(sec / 3600000),
			m = Math.floor((sec % 3600000) / 60000),
			s = Math.floor((sec % 60000) / 1000);
		return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	},
	timeToSec: time => {
		const multier = [1, 60, 3600, 86400];
		return time.split(':').reverse()
			.reduce((p, c, i) => p += c * multier[i], 0);
	},
	writeJson: (obj, file = 'cash', path = './files/', format, append) => {
		path.endsWith('/') || (path += '/');
		console.log(`writeJson to ` + path + file);
		fs.existsSync(path) || fs.mkdirSync(path, { recursive: true });
		return fs[append ? 'appendFileSync' : 'writeFileSync'](
			path + file + '.json',
			format
				? JSON.stringify(obj, null, '\t') + '\n'
				: JSON.stringify(obj)
		);
	},
	toString,
	writeText: (obj, file = 'cash', path = './files/', format, append) => {
		path.endsWith('/') || (path += '/');
		console.log(`writeText to ` + path + file);
		fs.existsSync(path) || fs.mkdirSync(path, { recursive: true });
		return fs[append ? 'appendFileSync' : 'writeFileSync'](
			path + file,
			toString(obj) + '\n'
		);
	},
	readJson: (file = 'cash', path = './files/') => {
		path.endsWith('/') || (path += '/');
		if (!fs.existsSync(path + file + '.json')) return null;
		console.log(`readJson from ` + file);
		return JSON.parse(fs.readFileSync(path + file + '.json', 'utf8'));
	},
	readText: (file, path = './files/') => {
		if (!fs.existsSync(path + file)) return '';
		console.log(`readText from ` + file);
		return fs.readFileSync(path + file, 'utf8');
	},
	fixTranslit: name => name.trim()
		.replace(/c/g, 'с').replace(/C/g, 'С')
		.replace(/p/g, 'р').replace(/P/g, 'Р')
		.replace(/o/g, 'о').replace(/O/g, 'О')
		.replace(/a/g, 'а').replace(/A/g, 'А'),
	nameSex: {
		'Алекс': 1, 'Феврония': 0, 'Артём': 1, 'Света': 0,
		'Август': 1, 'Августин': 1, 'Авраам': 1, 'Аврора': 0, 'Агата': 0, 'Агафон': 1, 'Агнесса': 0, 'Агния': 0, 'Ада': 0, 'Аделаида': 0, 'Аделина': 0, 'Адонис': 1, 'Акайо': 1, 'Акулина': 0, 'Алан': 1, 'Алевтина': 0, 'Александр': 1, 'Александра': 0, 'Алексей': 1, 'Алена': 0, 'Алёна': 0, 'Алина': 0, 'Алиса': 0, 'Алла': 0, 'Алсу': 0, 'Альберт': 1, 'Альбина': 0, 'Альфия': 0, 'Альфред': 1, 'Амалия': 0, 'Амелия': 0, 'Анастасий': 1, 'Анастасия': 0, 'Анатолий': 1, 'Ангелина': 0, 'Андрей': 1, 'Анжела': 0, 'Анжелика': 0, 'Анисий': 1, 'Анна': 0, 'Антон': 1, 'Антонина': 0, 'Анфиса': 0, 'Аполлинарий': 1, 'Аполлон': 1, 'Ариадна': 0, 'Арина': 0, 'Аристарх': 1, 'Аркадий': 1, 'Арсен': 1, 'Арсений': 1, 'Артем': 1, 'Артемий': 1, 'Артур': 1, 'Архип': 1, 'Ася': 0, 'Беатрис': 0, 'Белла': 0, 'Бенедикт': 1, 'Берта': 0, 'Богдан': 1, 'Божена': 0, 'Болеслав': 1, 'Борис': 1, 'Борислав': 1, 'Бронислав': 1, 'Бронислава': 0, 'Булат': 1, 'Вадим': 1, 'Валентин': 1, 'Валентина': 0, 'Валерий': 1, 'Валерия': 0, 'Ванда': 0, 'Варвара': 0, 'Василий': 1, 'Василиса': 0, 'Венера': 0, 'Вениамин': 1, 'Вера': 0, 'Вероника': 0, 'Викентий': 1, 'Виктор': 1, 'Виктория': 0, 'Вилен': 1, 'Виолетта': 0, 'Виссарион': 1, 'Вита': 0, 'Виталий': 1, 'Влад': 1, 'Владимир': 1, 'Владислав': 1, 'Влада': 0, 'Владислава': 0, 'Владлен': 1, 'Вольдемар': 1, 'Всеволод': 1, 'Вячеслав': 1, 'Габриэлла': 0, 'Гавриил': 1, 'Галина': 0, 'Гарри': 1, 'Гелла': 0, 'Геннадий': 1, 'Генриетта': 0, 'Георгий': 1, 'Герман': 1, 'Гертруда': 0, 'Глафира': 0, 'Глеб': 1, 'Глория': 0, 'Гордей': 1, 'Грейс': 0, 'Грета': 0, 'Григорий': 1, 'Гульмира': 0, 'Зинур': 1, 'Пётр': 1, 'Фёдор': 1, 'Раниль': 1,
		'Давид': 1, 'Дана': 0, 'Дамир': 1, 'Даниил': 1, 'Данила': 0, 'Даниэла': 0, 'Дарина': 0, 'Дарья': 0, 'Даяна': 0, 'Демьян': 1, 'Денис': 1, 'Джеймс': 1, 'Джек': 1, 'Джессика': 0, 'Джозеф': 1, 'Диана': 0, 'Дина': 0, 'Динара': 0, 'Дмитрий': 1, 'Добрыня': 1, 'Доминика': 0, 'Дора': 0, 'Ева': 0, 'Евгений': 1, 'Евгения': 0, 'Евдоким': 1, 'Евдокия': 0, 'Егор': 1, 'Екатерина': 0, 'Елена': 0, 'Елизавета': 0, 'Елисей': 1, 'Есения': 0, 'Ефим': 1, 'Ефрем': 1, 'Ефросинья': 0, 'Жаклин': 0, 'Жанна': 0, 'Ждан': 1, 'Захар': 1, 'Зинаида': 0, 'Зиновий': 1, 'Злата': 0, 'Зорий': 1, 'Зоряна': 0, 'Зоя': 0, 'Иван': 1, 'Иветта': 0, 'Игнатий': 1, 'Игорь': 1, 'Изабелла': 0, 'Изольда': 0, 'Илга': 0, 'Илларион': 1, 'Илона': 0, 'Илья': 1, 'Инга': 0, 'Инесса': 0, 'Инна': 0, 'Иннокентий': 1, 'Иосиф': 1, 'Ираида': 0, 'Ираклий': 1, 'Ирина': 0, 'Итан': 1, 'Ия': 0, 'Казимир': 1, 'Калерия': 0, 'Камилла': 0, 'Камиль': 1, 'Капитолина': 0, 'Карина': 0, 'Каролина': 0, 'Касьян': 1, 'Ким': 1, 'Кир': 1, 'Кира': 0, 'Кирилл': 1, 'Клавдия': 0, 'Клара': 0, 'Клариса': 0, 'Клим': 1, 'Климент': 1, 'Кондрат': 1, 'Константин': 1, 'Кристина': 0, 'Ксения': 0, 'Кузьма': 1, 'Лада': 0, 'Лариса': 0, 'Лев': 1, 'Леон': 1, 'Леонид': 1, 'Леонтий': 1, 'Леся': 0, 'Лидия': 0, 'Лика': 0, 'Лилиана': 0, 'Лилия': 0, 'Лина': 0, 'Лолита': 0, 'Луиза': 0, 'Лукьян': 1, 'Любовь': 0, 'Людмила': 0, 'Магдалина': 1, 'Майя': 0, 'Макар': 1, 'Максим': 1, 'Марат': 1, 'Маргарита': 0, 'Марианна': 0, 'Марина': 0, 'Мария': 0, 'Марк': 1, 'Марта': 0, 'Мартин': 1, 'Марфа': 0, 'Матвей': 1, 'Мелания': 0, 'Мелисса': 0, 'Милана': 0, 'Милена': 0, 'Мирон': 1, 'Мирослава': 0, 'Мирра': 0, 'Митрофан': 1, 'Михаил': 1, 'Мия': 0, 'Модест': 1, 'Моисей': 1, 'Мухаммед': 1, 'Надежда': 0, 'Назар': 1, 'Наоми': 0, 'Наталия': 0, 'Nаtаliiа': 0, 'Наталья': 0, 'Наум': 1, 'Нелли': 0, 'Ника': 0, 'Никанор': 1, 'Никита': 1, 'Никифор': 1, 'Николай': 1, 'Николь': 0, 'Никон': 1, 'Нина': 0, 'Нинель': 0, 'Нонна': 0, 'Нора': 0, 'Оксана': 0, 'Олег': 1, 'Олеся': 0, 'Оливер': 1, 'Оливия': 0, 'Ольга': 0, 'Оскар': 1, 'Павел': 1, 'Парамон': 1, 'Патрик': 1, 'Паула': 0, 'Петр': 1, 'Платон': 1, 'Полина': 0, 'Прасковья': 0, 'Прохор': 1, 'Рада': 0, 'Радмила': 0, 'Раиса': 0, 'Райан': 1, 'Раймонд': 1, 'Раяна': 0, 'Регина': 0, 'Ренат': 1, 'Рената': 0, 'Рику': 1, 'Римма': 0, 'Ринат': 1, 'Рита': 0, 'Роберт': 1, 'Родион': 1, 'Роза': 0, 'Роксана': 0, 'Роман': 1, 'Россияна': 0, 'Ростислав': 1, 'Руслан': 1, 'Рустам': 1, 'Рэн': 1, 'Сабина': 0, 'Савва': 1, 'Савелий': 1,
		'Саки': 0, 'Сакура': 0, 'Самсон': 1, 'Самуил': 1, 'Сарра': 0, 'Светлана': 0, 'Святослав': 1, 'Севастьян': 1, 'Семен': 1, 'Серафима': 0, 'Сергей': 1, 'Сильвия': 0, 'Снежана': 0, 'Сора': 1, 'София': 0, 'Софья': 0, 'Станислав': 1, 'Стелла': 0, 'Степан': 1, 'Стефания': 0, 'Таисия': 0, 'Такеши': 1, 'Тамара': 0, 'Тамила': 0, 'Тарас': 1, 'Татьяна': 0, 'Теодор': 1, 'Тереза': 0, 'Терентий': 1, 'Тимофей': 1, 'Тимур': 1, 'Тина': 0, 'Тихон': 1, 'Томас': 1, 'Трофим': 1, 'Ульяна': 0, 'Урсула': 0, 'Фаддей': 1, 'Фаина': 0, 'Федор': 1, 'Федот': 1, 'Феликс': 1, 'Филат': 1, 'Филимон': 1, 'Филипп': 1, 'Фома': 1, 'Фрида': 0, 'Хина': 0, 'Хлоя': 0, 'Чарли': 1, 'Шарлотта': 0, 'Шейла': 0, 'Шелли': 0, 'Эдгар': 1, 'Эдита': 0, 'Эдуард': 1, 'Элеонора': 0, 'Элина': 0, 'Элла': 0, 'Эльвира': 0, 'Эльдар': 1, 'Эльза': 0, 'Эмили': 0, 'Эмилия': 0, 'Эмма': 0, 'Эрик': 1, 'Эрика': 0, 'Юи': 0, 'Юлиан': 1, 'Юлиана': 0, 'Юлий': 1, 'Юлия': 0, 'Юма': 1, 'Юна': 0, 'Юрий': 1, 'Яков': 1, 'Ямато': 1, 'Яна': 0, 'Янина': 0, 'Ярослав': 1,
		'Настасья': 0
	}
};
