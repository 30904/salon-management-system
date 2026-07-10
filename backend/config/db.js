import dns from "dns";
import mongoose from "mongoose";

// Windows / some office networks block SRV lookups on the default DNS resolver.
// Node uses its own DNS path — public DNS fixes mongodb+srv:// Atlas URIs.
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
dns.setDefaultResultOrder("ipv4first");

const connectDB = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error(
      "MONGO_URI is not set. Copy backend/.env.example to backend/.env and paste the URI from Heramb."
    );
  }

  try {
    const connection = await mongoose.connect(uri);
    console.log(`[mongodb] Connected: ${connection.connection.host}`);
    console.log(`[mongodb] Database: ${connection.connection.name}`);
  } catch (error) {
    console.error("[mongodb] Connection failed:", error.message);
    process.exit(1);
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
