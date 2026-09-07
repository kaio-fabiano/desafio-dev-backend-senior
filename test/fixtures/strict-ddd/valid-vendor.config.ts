import { registerAs } from '@nestjs/config';

export default registerAs('identity', () => ({ issuer: 'identity' }));
