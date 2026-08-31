import { Injectable } from '@nestjs/common';
import { jwt } from 'better-auth/plugins';

export type JwtPluginOptions = Parameters<typeof jwt>[0];

export class JwtPluginFactory {
  create(options?: JwtPluginOptions): ReturnType<typeof jwt> {
    return jwt(options);
  }
}

Injectable()(JwtPluginFactory);
