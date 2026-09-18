import { ForbiddenException } from '@nestjs/common';
import { ActorType, AuthActor } from './auth-actor';

export function scopedVendorId(actor: AuthActor, requestedVendorId?: number): number | undefined {
    if (actor.type === ActorType.ADMIN) {
        return requestedVendorId ? Number(requestedVendorId) : undefined;
    }
    if (!actor.vendor_id) {
        throw new ForbiddenException('No vendor is linked to this account');
    }
    return actor.vendor_id;
}

export function requiredVendorId(actor: AuthActor, requestedVendorId?: number): number {
    const vendorId = scopedVendorId(actor, requestedVendorId);
    if (!vendorId) {
        throw new ForbiddenException('vendor_id is required');
    }
    return vendorId;
}

export function assertVendorAccess(actor: AuthActor, vendorId: number) {
    if (actor.type === ActorType.ADMIN) {
        return;
    }
    if (!vendorId || Number(vendorId) !== Number(actor.vendor_id)) {
        throw new ForbiddenException('You do not have access to this record');
    }
}

export function scopedClientstoreId(actor: AuthActor, requestedClientstoreId?: number): number | undefined {
    if (actor.type === ActorType.CLIENT && actor.clientstore_id) {
        return actor.clientstore_id;
    }
    return requestedClientstoreId ? Number(requestedClientstoreId) : undefined;
}

export function assertStoreDocumentAccess(actor: AuthActor, vendorId: number, clientstoreIds: number[]) {
    assertVendorAccess(actor, vendorId);
    if (actor.type === ActorType.CLIENT && actor.clientstore_id && !clientstoreIds.map(Number).includes(actor.clientstore_id)) {
        throw new ForbiddenException('You do not have access to this document');
    }
}
