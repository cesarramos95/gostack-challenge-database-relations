import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Customer from '@modules/customers/infra/typeorm/entities/Customer';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    // Checking by existent customers
    const customerExists = await this.customersRepository.findById(customer_id);

    if (!customerExists) {
      throw new AppError('Customer id invalid.');
    }

    // Checking by existent products
    const productExists = await this.productsRepository.findAllById(products);

    if (!productExists.length) {
      throw new AppError("There aren't any product found whit given ids");
    }

    const existentProductIds = productExists.map(product => product.id);

    // Checcking by inexistent products
    const inexistentProducts = products.filter(
      product => !existentProductIds.includes(product.id),
    );

    if (inexistentProducts.length) {
      throw new AppError(`Could not find product ${inexistentProducts[0].id}`);
    }

    // Checking by product without quantity available
    const findProductsWithoutQuantityAvailable = products.filter(
      product =>
        productExists.filter(p => p.id === product.id)[0].quantity <
        product.quantity,
    );

    if (findProductsWithoutQuantityAvailable.length) {
      throw new AppError(
        `The quantity ${findProductsWithoutQuantityAvailable[0].quantity} is not available for ${findProductsWithoutQuantityAvailable[0].id}`,
      );
    }

    const listedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: productExists.filter(p => p.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: customerExists,
      products: listedProducts,
    });

    const { order_products } = order;

    const productsQuantity = order_products.map(product => ({
      id: product.product_id,
      quantity:
        productExists.filter(p => p.id === product.product_id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(productsQuantity);

    return order;
  }
}

export default CreateOrderService;
