#!/bin/bash
set -e

# Start containers

echo "Starting containers..."
docker compose up -d

echo "Docker Compose status:"
docker compose ps

echo "Waiting for app and arc containers to become healthy..."
for i in {1..30}; do
  app_id=$(docker compose ps -q app)
  arc_id=$(docker compose ps -q arc)
  echo "app_id: $app_id, arc_id: $arc_id"
  app_status=$(docker inspect --format='{{.State.Health.Status}}' $app_id 2>/dev/null || echo "none")
  arc_status=$(docker inspect --format='{{.State.Health.Status}}' $arc_id 2>/dev/null || echo "none")
  echo "app: $app_status, arc: $arc_status"
  if [ "$app_status" = "healthy" ] && [ "$arc_status" = "healthy" ]; then
    echo "Both containers are healthy!"
    break
  fi
  sleep 10
done

if [ "$app_status" != "healthy" ] || [ "$arc_status" != "healthy" ]; then
  echo "Services did not become healthy in time."
  docker compose ps
  echo "\n--- arc logs ---"
  docker compose logs arc || true
  exit 1
fi

echo "Testing web page..."
curl -sI http://localhost:8008/ | grep -o '200 OK'
curl -s http://localhost:8008/ | grep -o '<title>Slim</title>'

echo "Testing DICOMweb service..."
curl -sI http://localhost:8080/dcm4chee-arc/aets/DCM4CHEE/rs/studies | grep -o '204 No Content'

echo "All tests passed!" 