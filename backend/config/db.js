import "./dnsSetup.js";
import mongoose from "mongoose";

/**
 * Convert mongodb+srv URI → standard replica-set URI when SRV DNS fails.
 * Override hosts with MONGO_SRV_FALLBACK_HOSTS (comma-separated host:port).
 */
function toSrvFallbackUri(uri) {
  const match = String(uri).match(
    /^mongodb\+srv:\/\/([^@]+)@([^/]+)\/([^?]+)?(\?.*)?$/i
  );
  if (!match) return null;

  const auth = match[1];
  const dbName = match[3] || "s21management";
  const query = match[4] || "";

  const fromEnv = String(process.env.MONGO_SRV_FALLBACK_HOSTS || "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);

  const hosts =
    fromEnv.length > 0
      ? fromEnv
      : [
          // Same Atlas project used elsewhere in this repo (uftuzf3)
          "ac-vlysbzs-shard-00-00.uftuzf3.mongodb.net:27017",
          "ac-vlysbzs-shard-00-01.uftuzf3.mongodb.net:27017",
          "ac-vlysbzs-shard-00-02.uftuzf3.mongodb.net:27017",
        ];

  const params = new URLSearchParams(
    query.startsWith("?") ? query.slice(1) : query
  );
  if (!params.has("ssl") && !params.has("tls")) {
    params.set("tls", "true");
  }
  if (!params.has("retryWrites")) {
    params.set("retryWrites", "true");
  }
  if (!params.has("w")) {
    params.set("w", "majority");
  }
  // Direct host list needs replicaSet when known
  if (!params.has("replicaSet") && process.env.MONGO_REPLICA_SET) {
    params.set("replicaSet", process.env.MONGO_REPLICA_SET);
  }

  return `mongodb://${auth}@${hosts.join(",")}/${dbName}?${params.toString()}`;
}

const connectDB = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error(
      "MONGO_URI is not set. Copy backend/.env.example to backend/.env and paste the URI from Heramb."
    );
  }

  const options = {
    maxPoolSize: 20,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 15_000,
  };

  try {
    const connection = await mongoose.connect(uri, options);
    console.log(`[mongodb] Connected: ${connection.connection.host}`);
    console.log(`[mongodb] Database: ${connection.connection.name}`);
  } catch (error) {
    const isSrv =
      String(uri).startsWith("mongodb+srv://") &&
      /ENOTFOUND|querySrv|ECONNREFUSED|ETIMEOUT|certificate/i.test(
        String(error.message || "")
      );

    if (!isSrv) {
      console.error("[mongodb] Connection failed:", error.message);
      process.exit(1);
    }

    const fallback = toSrvFallbackUri(uri);
    if (!fallback) {
      console.error("[mongodb] Connection failed:", error.message);
      process.exit(1);
    }

    console.warn(
      "[mongodb] SRV/DNS failed; retrying with direct host list fallback…"
    );
    console.warn(`[mongodb] First error: ${error.message}`);

    try {
      const connection = await mongoose.connect(fallback, options);
      console.log(`[mongodb] Connected (fallback): ${connection.connection.host}`);
      console.log(`[mongodb] Database: ${connection.connection.name}`);
    } catch (fallbackError) {
      console.error("[mongodb] Connection failed:", error.message);
      console.error("[mongodb] Fallback also failed:", fallbackError.message);
      console.error(
        "[mongodb] Tip: set MONGO_SRV_FALLBACK_HOSTS and MONGO_REPLICA_SET from Atlas → Connect → Drivers, or fix DNS / MONGO_URI hostname."
      );
      process.exit(1);
    }
  }
};

export function getDbStatus() {
  const stateLabels = ["disconnected", "connected", "connecting", "disconnecting"];
  const { readyState, name, host } = mongoose.connection;

  return {
    state: stateLabels[readyState] || "unknown",
    readyState,
    name: name || null,
    host: host || null,
  };
}

export default connectDB;
