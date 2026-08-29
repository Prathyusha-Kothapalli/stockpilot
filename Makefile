# StockPilot ERP System Build & Management Makefile

.PHONY: all install dev seed test test-python docker-build docker-run clean

all: install seed dev

install:
	@echo "Installing Node.js dependencies..."
	npm install

dev:
	@echo "Starting StockPilot ERP Server..."
	node server.js

seed:
	@echo "Seeding SQLite database with demo dataset..."
	node backend/db/seed.js

test:
	@echo "Running Node.js API automated Jest tests..."
	npm test

test-python:
	@echo "Running Python 3.10 analytics unittest suite..."
	python3 -m unittest discover -s python_services

docker-build:
	@echo "Building StockPilot Docker image..."
	docker build -t stockpilot:latest .

docker-run:
	@echo "Launching StockPilot Docker container..."
	docker-compose up --build -d

clean:
	@echo "Cleaning node_modules and temporary files..."
	rm -rf node_modules stockpilot.db
