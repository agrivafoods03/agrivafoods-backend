import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ContactService } from '../services/contactService.js';

export const submitContact = asyncHandler(async (req, res) => {
  const contact = await ContactService.submitContact(req.body);
  return ApiResponse.created(res, contact, 'Your inquiry has been received. Our team will get back to you shortly.');
});

export const getAllContacts = asyncHandler(async (req, res) => {
  const { status, page, limit } = req.query;
  const result = await ContactService.getAllContacts({ status, page, limit });
  return ApiResponse.success(res, result.contacts, 'Inquiries retrieved successfully', 200, {
    total: result.total,
    page: result.page,
    pages: result.pages
  });
});

export const updateContactStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const contact = await ContactService.updateContactStatus(req.params.id, status);
  return ApiResponse.success(res, contact, 'Inquiry status updated');
});

export const deleteContact = asyncHandler(async (req, res) => {
  const result = await ContactService.deleteContact(req.params.id);
  return ApiResponse.success(res, result, 'Inquiry deleted successfully');
});
