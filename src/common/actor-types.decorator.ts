import { SetMetadata } from '@nestjs/common';
import { ActorType } from './auth-actor';

export const ACTOR_TYPES_KEY = 'actorTypes';

export const ActorTypes = (...types: ActorType[]) => SetMetadata(ACTOR_TYPES_KEY, types);
