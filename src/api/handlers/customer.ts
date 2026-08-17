import { CustomerService } from '../../services/customer';
import { AppError } from '../../lib/errors/model';
import type { AppContext } from '../middleware';

export async function handleCustomerRequest(req: Request, ctx: AppContext): Promise<Response> {
  const customerService = new CustomerService(
    ctx.db,
    ctx.reqCtx,
    ctx.authCtx,
    ctx.tenantCtx,
    ctx.adminDb
  );

  switch (req.method) {
    case 'GET': {
      const customer = await customerService.getCurrentCustomer();
      if (!customer) {
        throw new AppError({
          code: 'VALIDATION_ERROR',
          publicMessage: 'Customer profile not found.',
          internalMessage: 'No current customer found.',
          httpStatus: 404,
          retryable: false
        });
      }
      return new Response(JSON.stringify({ data: customer }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    case 'POST': {
      const body = await req.json().catch(() => ({}));
      if (!body.email) {
        throw new AppError({
          code: 'VALIDATION_ERROR',
          publicMessage: 'Email is required.',
          internalMessage: 'Missing email in body.',
          httpStatus: 400,
          retryable: false
        });
      }
      
      const newCustomer = await customerService.createCustomer({
        email: body.email,
        document: body.document,
        full_name: body.full_name
      });
      
      return new Response(JSON.stringify({ data: newCustomer }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    case 'PATCH': {
      const body = await req.json().catch(() => ({}));
      
      const updatedCustomer = await customerService.updateCurrentCustomer({
        email: body.email,
        document: body.document,
        full_name: body.full_name
      });
      
      return new Response(JSON.stringify({ data: updatedCustomer }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    default:
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
  }
}
