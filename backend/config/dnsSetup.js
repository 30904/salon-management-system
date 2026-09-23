import dns from "node:dns";

/**
 * Force public DNS for Node lookups (mongodb+srv SRV records).
 * Some Windows / ISP resolvers return ENOTFOUND for Atlas.
 * Must load before mongoose.connect (imported first from server.js).
 */
dns.setServers(["1.1.1.1", "8.8.8.8"]);
dns.setDefaultResultOrder("ipv4first");

export default dns;
