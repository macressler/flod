REPORTER = dot

docs: doc

doc:
	@coffee --bare --compile --output lib/ src/

test: 
	@NODE_ENV=test ./node_modules/.bin/mocha --recursive --reporter $(REPORTER) --ignore-leaks --compilers coffee:coffee-script

.PHONY: test doc docs