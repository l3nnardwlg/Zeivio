import 'dotenv/config';
import jwt from 'jsonwebtoken';
const JWT_EXPIRES_IN = '7d';
export interface TokenPayload {userId:string;email:string;}
function secret():string {
  const value=process.env.JWT_SECRET;
  if(!value || value.length<32) throw new Error('JWT_SECRET environment variable must be at least 32 characters.');
  return value;
}
export function generateToken(payload:TokenPayload):string{
  return jwt.sign(payload,secret(),{expiresIn:JWT_EXPIRES_IN});
}
export function verifyToken(token:string):TokenPayload {
  return jwt.verify(token,secret()) as TokenPayload;
}
