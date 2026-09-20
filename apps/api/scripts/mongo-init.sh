#!/usr/bin/env bash
# One-shot bootstrap for the local MongoDB container (see ../compose.yml).
# Turns the single-node `mongod` into a replica set, which MongoDB requires for
# multi-document transactions and change streams. Idempotent: safe to re-run.
set -e

mongosh --host mongodb:27017 --quiet --eval '
  try {
    rs.status();
    print("Replica set already initialized");
  } catch (error) {
    if (error.code === 94) {
      rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "localhost:27017" }] });
      print("Replica set initialized");
    } else {
      throw error;
    }
  }
'

until mongosh --host mongodb:27017 --quiet --eval 'db.hello().isWritablePrimary' | grep -q true; do
  sleep 1
done

echo "Replica set primary is ready"
