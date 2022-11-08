class CartRemoveButton extends HTMLElement {
  constructor() {
    super();
    this.addEventListener('click', (event) => {
      event.preventDefault();
      const cartItems = this.closest('cart-items') || this.closest('cart-drawer-items');
      cartItems.updateQuantity(this.dataset.index, 0);
    });
  }
}

customElements.define('cart-remove-button', CartRemoveButton);

class CartItems extends HTMLElement {
  constructor() {
    super();

    this.lineItemStatusElement = document.getElementById('shopping-cart-line-item-status') || document.getElementById('CartDrawer-LineItemStatus');

    this.currentItemCount = Array.from(this.querySelectorAll('[name="updates[]"]'))
      .reduce((total, quantityInput) => total + parseInt(quantityInput.value), 0);

    this.debouncedOnChange = debounce((event) => {
      this.onChange(event);
    }, 300);

    this.addEventListener('change', this.debouncedOnChange.bind(this));

    // Custom Functionality for adding or removing gift products in cart.
    this.checkGiftToAdd();
  }

  onChange(event) {
    this.updateQuantity(event.target.dataset.index, event.target.value, document.activeElement.getAttribute('name'));
  }

  getSectionsToRender() {
    return [
      {
        id: 'main-cart-items',
        section: document.getElementById('main-cart-items').dataset.id,
        selector: '.js-contents',
      },
      {
        id: 'cart-icon-bubble',
        section: 'cart-icon-bubble',
        selector: '.shopify-section'
      },
      {
        id: 'cart-live-region-text',
        section: 'cart-live-region-text',
        selector: '.shopify-section'
      },
      {
        id: 'main-cart-footer',
        section: document.getElementById('main-cart-footer').dataset.id,
        selector: '.js-contents',
      }
    ];
  }

  updateQuantity(line, quantity, name) {
    this.showOverlay();
    this.enableLoading(line);

    const body = JSON.stringify({
      line,
      quantity,
      sections: this.getSectionsToRender().map((section) => section.section),
      sections_url: window.location.pathname
    });

    fetch(`${routes.cart_change_url}`, { ...fetchConfig(), ...{ body } })
      .then((response) => {
        return response.text();
      })
      .then((state) => {
        const parsedState = JSON.parse(state);
        this.classList.toggle('is-empty', parsedState.item_count === 0);
        const cartDrawerWrapper = document.querySelector('cart-drawer');
        const cartFooter = document.getElementById('main-cart-footer');

        if (cartFooter) cartFooter.classList.toggle('is-empty', parsedState.item_count === 0);
        if (cartDrawerWrapper) cartDrawerWrapper.classList.toggle('is-empty', parsedState.item_count === 0);

        this.getSectionsToRender().forEach((section => {
          const elementToReplace =
            document.getElementById(section.id).querySelector(section.selector) || document.getElementById(section.id);
          elementToReplace.innerHTML =
            this.getSectionInnerHTML(parsedState.sections[section.section], section.selector);
        }));

        this.updateLiveRegions(line, parsedState.item_count);
        const lineItem = document.getElementById(`CartItem-${line}`) || document.getElementById(`CartDrawer-Item-${line}`);
        if (lineItem && lineItem.querySelector(`[name="${name}"]`)) {
          cartDrawerWrapper ? trapFocus(cartDrawerWrapper, lineItem.querySelector(`[name="${name}"]`)) : lineItem.querySelector(`[name="${name}"]`).focus();
        } else if (parsedState.item_count === 0 && cartDrawerWrapper) {
          trapFocus(cartDrawerWrapper.querySelector('.drawer__inner-empty'), cartDrawerWrapper.querySelector('a'))
        } else if (document.querySelector('.cart-item') && cartDrawerWrapper) {
          trapFocus(cartDrawerWrapper, document.querySelector('.cart-item__name'))
        }
        this.disableLoading();
        this.checkGiftToAdd();
      }).catch(() => {
        this.querySelectorAll('.loading-overlay').forEach((overlay) => overlay.classList.add('hidden'));
        const errors = document.getElementById('cart-errors') || document.getElementById('CartDrawer-CartErrors');
        errors.textContent = window.cartStrings.error;
        this.disableLoading();

      });
  }

  updateLiveRegions(line, itemCount) {
    if (this.currentItemCount === itemCount) {
      const lineItemError = document.getElementById(`Line-item-error-${line}`) || document.getElementById(`CartDrawer-LineItemError-${line}`);
      const quantityElement = document.getElementById(`Quantity-${line}`) || document.getElementById(`Drawer-quantity-${line}`);
      lineItemError
        .querySelector('.cart-item__error-text')
        .innerHTML = window.cartStrings.quantityError.replace(
          '[quantity]',
          quantityElement.value
        );
    }

    this.currentItemCount = itemCount;
    this.lineItemStatusElement.setAttribute('aria-hidden', true);

    const cartStatus = document.getElementById('cart-live-region-text') || document.getElementById('CartDrawer-LiveRegionText');
    cartStatus.setAttribute('aria-hidden', false);

    setTimeout(() => {
      cartStatus.setAttribute('aria-hidden', true);
    }, 1000);
  }

  getSectionInnerHTML(html, selector) {
    return new DOMParser()
      .parseFromString(html, 'text/html')
      .querySelector(selector).innerHTML;
  }

  enableLoading(line) {
    const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
    mainCartItems.classList.add('cart__items--disabled');

    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading-overlay`);
    const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading-overlay`);

    [...cartItemElements, ...cartDrawerItemElements].forEach((overlay) => overlay.classList.remove('hidden'));

    document.activeElement.blur();
    this.lineItemStatusElement.setAttribute('aria-hidden', false);
  }

  disableLoading() {
    const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
    mainCartItems.classList.remove('cart__items--disabled');
  }

  checkGiftToAdd(){
    /* Adding Needed Gift Products and removing Not needed gifts from cart start */
    this.showOverlay();
    if($('.yet_to_be_added_products').length > 0){
      this.addGiftProduct();
    }
    if($('.yet_to_be_remove_products').length > 0){
      this.removeGiftProduct();
    }
    if($('.yet_to_be_remove_products').length == 0 && $('.yet_to_be_added_products').length == 0){
      this.removeOverlay();
    }

    /* Adding Needed Gift Products and removing Not needed gifts from cart end */
    var percentage = (parseFloat($(".cart_total_price").val()) / 240000)*100;
    if(percentage>100){
      percentage = 100;
    }
    this.move(percentage);
  }

  move(limit) {
    var elem = document.getElementById("myBar");
    var width = 1;
    var id = setInterval(frame, 10);
    function frame() {
      if (width >= limit) {
        clearInterval(id);
      } else {
        width++;
        elem.style.width = width + '%';
      }
    }
  }

  addGiftProduct(){
    const this_ = this;
    var items = [];
    // Get all the to add products generated via liquid and forming input to add the product to cart.

    $.each($('.yet_to_be_added_products'),function(index,val){
      var formBody = {
        'id': $(this).val(),
        'quantity': 1
      }
      items.push(formBody);
    });
    
    if(items.length > 0){
      this.changeCart("/cart/add.js?"+this_.getSectionsURL(),"POST",{items:items});
    }
  }
  removeGiftProduct(){
    const this_ = this;
    var items = {};
    // Get all the to add products generated via liquid and forming input to add the product to cart.

    $.each($('.yet_to_be_remove_products'),function(index,val){
      var variantId = $(this).val();
      items[variantId] = 0;
    });
    if(Object.keys(items).length > 0){
      this.changeCart("/cart/update.js?"+this_.getSectionsURL(),"POST",{updates:items});
    }
  }

  getSectionsURL(){
    // Common place to return all the cart section need to be rendered.
    // Max 5 sections can be passed.
    return "sections="+document.getElementById('main-cart-items').dataset.id+",cart-icon-bubble,cart-live-region-text,"+document.getElementById('main-cart-footer').dataset.id+"&sections_url=/";    
  }

  changeCart(cartURL,method,formBody,callBack){
    const this_ = this;
    $.ajax({
      type: method,
      url: cartURL,
      data: formBody,
      dataType: 'json',
      success: function (data) {
        this_.refreshCart(data);
      },
      error:function(data) {
        console.log("Error while changing cart");
      }
    });

  }

  showOverlay(){
    $(".full-overlay").show();
    $(".cart__items .js-contents").addClass("load");
    $("body").css("overflow","hidden");
  }

  removeOverlay(){
    $(".full-overlay").hide();
    $(".cart__items .js-contents").removeClass("load");
    $("body").css("overflow","inherit");
  }

  refreshCart(parsedState){
    this.getSectionsToRender().forEach((section => {
      const elementToReplace =
        document.getElementById(section.id).querySelector(section.selector) || document.getElementById(section.id);
      elementToReplace.innerHTML =
        this.getSectionInnerHTML(parsedState.sections[section.section], section.selector);
    }));
    this.removeOverlay();
  }
}

customElements.define('cart-items', CartItems);

if (!customElements.get('cart-note')) {
  customElements.define('cart-note', class CartNote extends HTMLElement {
    constructor() {
      super();

      this.addEventListener('change', debounce((event) => {
        const body = JSON.stringify({ note: event.target.value });
        fetch(`${routes.cart_update_url}`, { ...fetchConfig(), ...{ body } });
      }, 300))
    }
  });
};
