import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export enum ActorType {
    ADMIN = 'admin',
    CLIENT = 'client',
    USER = 'user',
}

export interface AuthActor {
    id: number;
    type: ActorType;
    role_id: number | null;
    vendor_id: number | null;
    clientstore_id: number | null;
    client_type: string | null;
}

export const Actor = createParamDecorator((_: unknown, context: ExecutionContext): AuthActor => {
    const request = context.switchToHttp().getRequest();
    return request.actor;
});
