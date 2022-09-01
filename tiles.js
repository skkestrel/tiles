let selected = undefined;
let to = undefined;
let domlistener = false;
let latest_board = undefined;

var observeDOM = (function () {
	var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;

	return function (objs, callback) {
		if (MutationObserver) {
			// define a new observer
			var mutationObserver = new MutationObserver(callback);

			// have the observer observe foo for changes in children
			for (const o of objs) {
				mutationObserver.observe(o, { childList: true, subtree: true, attributes: true });
			}
			return mutationObserver;
		}

		// browser support fallback
		else if (window.addEventListener) {
			for (const o of objs) {
				o.addEventListener("DOMNodeInserted", callback, false);
				o.addEventListener("DOMNodeRemoved", callback, false);
			}
		}
	};
})();

Object.defineProperty(Object.prototype, "board", {
	set: x => {
		this._board = x;
		latest_board = x;
		const nl = x[0].layers.length;

		const iter = () => {
			console.log(latest_board);
			console.log("WS", selected);

			const match = (i, j, blacklist) => {
				if (i === j) return [false, undefined];

				let ok = false;
				let matches = [];
				for (let k = 0; k < nl; k++) {
					if (
						latest_board[i].layers[k].id === latest_board[j].layers[k].id &&
						!latest_board[i].layers[k].hidden &&
						!latest_board[j].layers[k].hidden
					) {
						const id = latest_board[i].layers[k].id;
						if (blacklist && blacklist.indexOf(id) >= 0) continue;
						matches.push(id);

						ok = true;
					}
				}

				return [ok, matches];
			};

			const nhidden = layers => layers.reduce((a, c) => a + c.hidden, 0);

			const greaterthan = (a, b, cutoff) => {
				// prioritize making it to the cutoff

				if (a >= cutoff) {
					return a > b;
				} else if (b >= cutoff) {
					return false;
				} else {
					// otherwise, prioritize most clears
					return a % 1 > b % 1;
				}
			};

			const cutoff = 5;
			const eval = (ind, visited, blacklist) => {
				if (visited.length > cutoff) {
					return 0;
				} else {
					let max = 0;
					let imax = -1;
					let idmax = [];

					for (let i = 0; i < 30; i++) {
						if (visited.indexOf(i) >= 0) continue;

						let cur = 0;
						const [ok, ids] = match(i, ind, blacklist);

						if (ok) {
							cur += eval(i, [...visited, ind], [...blacklist, ...ids])[0] + 1;

							if (nhidden(latest_board[ind].layers) === nl - ids.length) {
								cur += 0.001;
							}
							if (nhidden(latest_board[i].layers) === nl - ids.length) {
								cur += 0.001;
							}
						}

						if (greaterthan(cur, max, cutoff - visited.length)) {
							max = cur;
							imax = i;
							idmax = ids;
						}
					}

					return [max, imax, idmax];
				}
			};

			let best = -1;
			let bestid = -1;
			let bestlinks = [];

			if (selected === undefined) {
				for (let i = 0; i < 30; i++) {
					// none selected; ensure nonempty
					if (nhidden(latest_board[i].layers) === nl) continue;

					const [max, imax, idmax] = eval(i, [], []);
					if (greaterthan(max, best, cutoff)) {
						best = max;
						bestid = imax;
						bestlinks = idmax;
					}
				}
			} else {
				const [bestscore, bestnext, bestnextlinks] = eval(selected, [], []);

				best = bestscore;
				bestid = bestnext;
				bestlinks = bestnextlinks;
			}

			console.log("B", best, bestid);

			if (bestid < 0) {
				console.log("Abort");
				return;
			}

			console.log("C", bestid);

			if (selected === undefined || nhidden(latest_board[bestid].layers) < nl - bestlinks.length) {
				selected = bestid;
			} else {
				selected = undefined;
			}

			const tiles = document.getElementsByClassName("tls-tile");
			tiles[bestid].click();
		};

		if (!domlistener) {
			domlistener = true;
			setTimeout(() => {
				const els = document.getElementsByClassName("tls-tile");
				for (let i = 0; i < 30; i++) {
					observeDOM([els[i].children[0], els[i].children[2]], e => {
						console.log("U", i);
						clearTimeout(to);
						to = setTimeout(() => {
							iter();
						}, 10);
					});
				}

				iter();
			}, 2000);
		}
	},
	get: () => this._board,
	configurable: true,
});
