import { createRepository } from "../src/campus/repository.js";
import { VARIANTS, verifyPassword } from "../src/campus/domain.js";
const variant=process.env.VARIANT;
const repo=await createRepository(variant);
try {
  const user=await repo.userByUsername("admin");
  const safe=VARIANTS[variant].safe;
  const passwordStorageValid=safe ? user.password===null && verifyPassword("Admin@123",user.passwordHash) : user.password==="Admin@123" && user.passwordHash===null;
  await repo.ping();
  const tickets=await repo.tickets(null);
  console.log(JSON.stringify({variant,database:repo.databaseName,passwordStorage:safe?"scrypt-only":"synthetic-plaintext-intentionally-unsafe",passwordStorageValid,ticketCount:tickets.length,ok:passwordStorageValid && tickets.length>=12}));
  if(!passwordStorageValid) process.exitCode=1;
} finally { await repo.close(); }
