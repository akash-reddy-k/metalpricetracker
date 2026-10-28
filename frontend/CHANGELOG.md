# Changelog

## [0.5.1](https://github.com/akash-reddy-k/metalpricetracker/compare/metalprices-frontend-v0.5.0...metalprices-frontend-v0.5.1) (2026-10-28)


### Bug Fixes

* price Indian gold and silver off MCX instead of spot plus flat duty ([b879975](https://github.com/akash-reddy-k/metalpricetracker/commit/b879975da42e79e791854472136da262cb06ed62))
* price Indian gold and silver off MCX instead of spot plus flat duty ([cb857bf](https://github.com/akash-reddy-k/metalpricetracker/commit/cb857bf1ba4cdcdc66d582d08023638240507089))

## [0.5.0](https://github.com/akash-reddy-k/metalpricetracker/compare/metalprices-frontend-v0.4.3...metalprices-frontend-v0.5.0) (2026-10-12)


### Features

* let a later Gemini run upgrade a template news article ([95284bd](https://github.com/akash-reddy-k/metalpricetracker/commit/95284bd0c8aabd2d6a959b962cd3679e2fcd4fbb))


### Improvements

* store news as one timestamped file per article ([5a874de](https://github.com/akash-reddy-k/metalpricetracker/commit/5a874de464e1adf8f750acc5d6fe15ed697e7c93))

## [0.4.3](https://github.com/akash-reddy-k/metalpricetracker/compare/metalprices-frontend-v0.4.2...metalprices-frontend-v0.4.3) (2026-10-12)


### Bug Fixes

* retry Gemini call and raise timeout so news generation is robust ([9c1c078](https://github.com/akash-reddy-k/metalpricetracker/commit/9c1c078e8791f147781e9e9529ed87d4bfb99140))
* wait for required checks before merging news PR; raise Gemini timeout to 300s ([44d8613](https://github.com/akash-reddy-k/metalpricetracker/commit/44d8613e6ae11d560d1144c02f5281779a6110b7))

## [0.4.2](https://github.com/akash-reddy-k/metalpricetracker/compare/metalprices-frontend-v0.4.1...metalprices-frontend-v0.4.2) (2026-10-12)


### Bug Fixes

* update default Gemini model to gemini-3.8-flash ([d73b587](https://github.com/akash-reddy-k/metalpricetracker/commit/d73b58740525d2140ca87a8cc3e8de8e117449d8))

## [0.4.1](https://github.com/akash-reddy-k/metalpricetracker/compare/metalprices-frontend-v0.4.0...metalprices-frontend-v0.4.1) (2026-10-09)


### Bug Fixes

* bust poisoned asset hashes with a cache-revision salt ([df182c6](https://github.com/akash-reddy-k/metalpricetracker/commit/df182c654dd7c44791bddbdbd44a479d94a6e3e8))
* bust poisoned asset hashes with a cache-revision salt ([e5f0fc0](https://github.com/akash-reddy-k/metalpricetracker/commit/e5f0fc07f8a3336f6d83b2a0e83be5905180ac0c))

## [0.4.0](https://github.com/akash-reddy-k/metalpricetracker/compare/metalprices-frontend-v0.3.1...metalprices-frontend-v0.4.0) (2026-10-08)


### Features

* add automated weekly news system with rich article pages ([59fb62c](https://github.com/akash-reddy-k/metalpricetracker/commit/59fb62c9e3711b1e61868ca65e82aee8c57ec02d))
* add automated weekly news system with rich article pages ([fe4e258](https://github.com/akash-reddy-k/metalpricetracker/commit/fe4e2582bfcbf00d288a1a9f6295e908154708c3))


### Bug Fixes

* stop cache-poisoning white screen on missing assets ([cde5460](https://github.com/akash-reddy-k/metalpricetracker/commit/cde5460ec3f2595e2a55689d3e9d6b68b87d2f3d))

## [0.3.1](https://github.com/akash-reddy-k/metalpricetracker/compare/metalprices-frontend-v0.3.0...metalprices-frontend-v0.3.1) (2026-10-08)


### Bug Fixes

* improve TradingView chart UX — currency conversion, reliable reload, inner page nav ([d43fefb](https://github.com/akash-reddy-k/metalpricetracker/commit/d43fefb7ae1aa39986f8b60d4823a414449b03aa))


### Performance

* remove TradingView chart from homepage to improve load time and SEO ([def164a](https://github.com/akash-reddy-k/metalpricetracker/commit/def164a9bd9031debff11a7a6565858ae4795ac5))

## [0.3.0](https://github.com/akash-reddy-k/metalpricetracker/compare/metalprices-frontend-v0.2.0...metalprices-frontend-v0.3.0) (2026-10-08)


### Features

* update index.html for improved SEO and user experience; add caching headers ([47a6530](https://github.com/akash-reddy-k/metalpricetracker/commit/47a653050f84640b0606321cd617e715ae1389a3))
* update index.html for improved SEO and user experience; add caching headers ([83f66a6](https://github.com/akash-reddy-k/metalpricetracker/commit/83f66a69d6af093854835f5748536ae2b87b8e60))


### Bug Fixes

* resolve SEO bugs preventing Google indexing ([945801e](https://github.com/akash-reddy-k/metalpricetracker/commit/945801e811a0da6a1a1b1f81199a30394790ea7b))
* resolve SEO bugs preventing Google indexing ([9f0068c](https://github.com/akash-reddy-k/metalpricetracker/commit/9f0068c4d48c60a696ba03f1d1ce257773e498ce))

## [0.2.0](https://github.com/akash-reddy-k/metalpricetracker/compare/metalprices-frontend-v0.1.1...metalprices-frontend-v0.2.0) (2026-09-01)


### Features

* enhance SEO and performance optimizations in index.html ([1e132ab](https://github.com/akash-reddy-k/metalpricetracker/commit/1e132ab129a1cc7be2d001080ad1cde03c7a4ed7))
* enhance SEO and performance optimizations in index.html ([dc20ec0](https://github.com/akash-reddy-k/metalpricetracker/commit/dc20ec080c720efa601ab70b4e9b789711485265))

## [0.1.1](https://github.com/akash-reddy-k/metalpricetracker/compare/metalprices-frontend-v0.1.0...metalprices-frontend-v0.1.1) (2026-08-31)


### Improvements

* seperate backend and frontend ([268a72b](https://github.com/akash-reddy-k/metalpricetracker/commit/268a72b97bc9b645fa9e41165ba6b406b5faa187))
* seperate backend and frontend ([9a1a7c0](https://github.com/akash-reddy-k/metalpricetracker/commit/9a1a7c0d12967c88c90c48da630c79ce1fb3bef3))
