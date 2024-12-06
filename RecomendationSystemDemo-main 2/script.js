// Biến toàn cục
let currentUser = null;
let productsData = null;
let currentCategory = null;
let selectedProduct = null;
let tfidfVectors = [];
let vocabulary = [];

// Hàm tải file JSON (chỉ đọc)
async function loadJSON(file) {
  try {
    const response = await fetch(file);
    if (!response.ok) {
      console.error(`Không thể tải file: ${file}`, response.status);
      return null;
    }
    const data = await response.json();
    console.log('Dữ liệu tải từ file:', file, data);
    return data;
  } catch (error) {
    console.error(`Lỗi khi tải file: ${file}`, error);
    return null;
  }
}


// Lưu và lấy dữ liệu từ LocalStorage
function saveToLocalStorage(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function getFromLocalStorage(key) {
  return JSON.parse(localStorage.getItem(key));
}

// Đăng nhập
async function login() {
  const usernameInput = document.getElementById('username').value.trim().toLowerCase();
  const users = await loadJSON('users.json');
  const user = users.users.find(u => u.username.toLowerCase() === usernameInput);

  if (user) {
    currentUser = user;
    saveToLocalStorage('currentUser', currentUser);

    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('home-content').classList.remove('hidden');
    loadHomePage();

    // Tải giỏ hàng cho tài khoản đã đăng nhập
    const cart = getCartForUser(user.username);
    saveToLocalStorage('purchasedProducts', cart); // Đồng bộ với giao diện
  } else {
    alert('Tên đăng nhập không hợp lệ.');
  }
}

function logout() {
  // Lưu giỏ hàng hiện tại trước khi đăng xuất
  if (currentUser) {
    const username = currentUser.username;
    const cart = getFromLocalStorage('purchasedProducts') || [];
    saveCartForUser(username, cart);
  }

  // Xóa thông tin người dùng khỏi LocalStorage
  localStorage.removeItem('currentUser');
  localStorage.removeItem('purchasedProducts');
  // Chuyển hướng về trang đăng nhập
  window.location.href = 'index.html';
}

// Tải dữ liệu trang chủ
async function loadHomePage() {
  productsData = await loadJSON('products.json');
  if (!productsData) {
    console.error('Không thể tải dữ liệu sản phẩm.');
    return;
  }

  buildProductKeywords();
  vocabulary = buildVocabulary(productsData);

  const tf = computeTF(productsData, vocabulary);
  const idf = computeIDF(productsData, vocabulary);
  tfidfVectors = computeTFIDF(tf, idf);

  console.log('Dữ liệu sản phẩm đã tải:', productsData);

  // Hiển thị sản phẩm gợi ý
  displayRecommendedProducts();

  // Hiển thị sản phẩm nổi bật
  const allProducts = productsData.categories.flatMap(c => c.products);
  const randomProducts = allProducts.sort(() => 0.5 - Math.random()).slice(0, 10);
  displayProducts(randomProducts, 'featured-products');
}


// Hiển thị sản phẩm
function displayProducts(products, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  products.forEach(product => {
    const productDiv = document.createElement('div');
    productDiv.className = 'product';
    productDiv.innerHTML = `
      <img src="${product.image}" alt="${product.name}">
      <h3>${product.name}</h3>
      <h5>${product.description}</h5>
      <button onclick="viewProduct(${product.id})">Xem</button>
      <button onclick="buyProduct(${product.id})">Mua</button>
    `;
    container.appendChild(productDiv);
  });
}

// Xây dựng từ khóa cho sản phẩm
function buildProductKeywords() {
  productsData.categories.forEach(category => {
    category.products.forEach(product => {
      const keywords = [];
      // Tách từ từ tên sản phẩm, mô tả và danh mục
      const nameWords = product.name.toLowerCase().split(/\s+/);
      const descWords = product.description.toLowerCase().split(/\s+/);
      const categoryWords = category.name.toLowerCase().split(/\s+/);
      keywords.push(...nameWords, ...descWords, ...categoryWords);
      // Loại bỏ ký tự đặc biệt và số
      product.keywords = keywords.map(word => word.replace(/[^a-zA-Záàảãạâấầẩẫậăắằẳẵặđéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵ]/g, ''));
    });
  });
}

// Xây dựng từ vựng
function buildVocabulary(productsData) {
  const vocabSet = new Set();
  productsData.categories.forEach(category => {
    category.products.forEach(product => {
      product.keywords.forEach(keyword => {
        if (keyword) vocabSet.add(keyword);
      });
    });
  });
  return Array.from(vocabSet);
}

// Tính TF
function computeTF(productsData, vocabulary) {
  const tfArray = [];
  productsData.categories.forEach(category => {
    category.products.forEach(product => {
      const tf = {};
      vocabulary.forEach(term => {
        const termCount = product.keywords.filter(k => k === term).length;
        tf[term] = termCount / product.keywords.length;
      });
      tfArray.push(tf);
    });
  });
  return tfArray;
}

// Tính IDF
function computeIDF(productsData, vocabulary) {
  const idf = {};
  const totalDocs = productsData.categories.reduce((sum, category) => sum + category.products.length, 0);
  vocabulary.forEach(term => {
    let docsWithTerm = 0;
    productsData.categories.forEach(category => {
      category.products.forEach(product => {
        if (product.keywords.includes(term)) {
          docsWithTerm++;
        }
      });
    });
    idf[term] = Math.log10(totalDocs / (1 + docsWithTerm));
  });
  return idf;
}

// Tính TF-IDF
function computeTFIDF(tfArray, idf) {
  return tfArray.map(tf => {
    const tfidf = {};
    for (let term in tf) {
      tfidf[term] = tf[term] * idf[term];
    }
    return tfidf;
  });
}

// Tính Cosine Similarity
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let term in vecA) {
    dotProduct += (vecA[term] || 0) * (vecB[term] || 0);
    normA += (vecA[term] || 0) ** 2;
  }
  for (let term in vecB) {
    normB += (vecB[term] || 0) ** 2;
  }
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (normA * normB);
}

// Lấy sản phẩm gợi ý kết hợp Content-Based và Collaborative Filtering
function getRecommendations() {
  if (!currentUser) return [];

  // Lấy lịch sử tương tác của người dùng
  const userInteractions = getFromLocalStorage('userInteractions') || {};
  const interactedProductIds = userInteractions.views || [];

  // Tìm sản phẩm đề xuất từ Collaborative Filtering
  const collaborativeRecs = getCollaborativeRecommendations(currentUser, productsData);
  if (collaborativeRecs.length > 0) {
    return collaborativeRecs;
  } else {
    // Nếu không có đề xuất từ Collaborative Filtering, sử dụng Content-Based
    const contentBasedRecs = getContentBasedRecommendations(interactedProductIds, productsData, tfidfVectors);
    return contentBasedRecs;
  }
}

// Tìm sản phẩm đề xuất dựa trên Content-Based Filtering
// Lấy gợi ý sản phẩm dựa trên TF-IDF và Cosine Similarity
function getContentBasedRecommendations(userCart, productsData, tfidfVectors) {
  if (userCart.length === 0) return [];

  // Lấy các vector TF-IDF của sản phẩm người dùng đã mua
  const userProductVectors = [];
  userCart.forEach(productId => {
    const index = getProductIndexById(productId);
    if (index !== -1) {
      userProductVectors.push(tfidfVectors[index]);
    }
  });

  // Tính similarity giữa các sản phẩm đã mua và tất cả sản phẩm khác
  const recommendationScores = [];

  tfidfVectors.forEach((vector, index) => {
    const product = getProductByIndex(index);
    if (userCart.includes(product.id)) return; // Bỏ qua sản phẩm đã mua

    let totalSimilarity = 0;
    userProductVectors.forEach(userVector => {
      totalSimilarity += cosineSimilarity(userVector, vector); // Tính similarity giữa 2 vector
    });

    const avgSimilarity = totalSimilarity / userProductVectors.length;
    recommendationScores.push({ product, score: avgSimilarity });
  });

  // Sắp xếp các sản phẩm theo độ tương đồng giảm dần
  recommendationScores.sort((a, b) => b.score - a.score);

  // Trả về các sản phẩm gợi ý (Top 10 sản phẩm tương tự nhất)
  return recommendationScores.slice(0, 10).map(item => item.product);
}


// Tìm sản phẩm đề xuất dựa trên Collaborative Filtering
function getCollaborativeRecommendations(currentUser, productsData) {
  // Do không có dữ liệu từ nhiều người dùng khác, chúng ta sẽ sử dụng lịch sử tương tác của chính người dùng
  // hoặc giả lập dữ liệu nếu có
  return []; // Trả về mảng rỗng nếu không có dữ liệu
}

// Các hàm hỗ trợ
function getProductIndexById(productId) {
  let index = -1;
  let count = 0;
  for (const category of productsData.categories) {
    for (const product of category.products) {
      if (product.id === productId) {
        index = count;
        break;
      }
      count++;
    }
    if (index !== -1) break;
  }
  return index;
}

function getProductIdByIndex(index) {
  let count = 0;
  for (const category of productsData.categories) {
    for (const product of category.products) {
      if (count === index) {
        return product.id;
      }
      count++;
    }
  }
  return null;
}

function getProductByIndex(index) {
  let count = 0;
  for (const category of productsData.categories) {
    for (const product of category.products) {
      if (count === index) {
        return product;
      }
      count++;
    }
  }
  return null;
}

// Tìm sản phẩm theo ID
function findProductById(productId) {
  if (!productsData || !productsData.categories) {
    console.error('productsData chưa được tải hoặc không hợp lệ.');
    return null;
  }

  for (const category of productsData.categories) {
    const product = category.products.find(p => p.id === productId);
    if (product) return product;
  }

  console.warn(`Không tìm thấy sản phẩm với ID: ${productId}`);
  return { name: 'Sản phẩm không tồn tại', image: '', description: '' }; // Giá trị mặc định
}



// Xem sản phẩm
function viewProduct(productId) {
  selectedProduct = findProductById(productId);
  saveToLocalStorage('selectedProduct', selectedProduct);
  
  // Lưu lịch sử xem
  saveInteraction('views', productId);

  // Chuyển đến trang chi tiết sản phẩm
  window.location.href = 'product-detail.html';
}

// Mua sản phẩm
function buyProduct(productId) {
  if (!currentUser) {
    alert('Vui lòng đăng nhập để mua sản phẩm.');
    return;
  }

  const username = currentUser.username;
  const cart = getCartForUser(username);

  if (!cart.includes(productId)) {
    cart.push(productId);
    saveCartForUser(username, cart); // Lưu giỏ hàng ngay khi thêm
    alert(`Bạn đã mua sản phẩm: ${findProductById(productId).name}`);
  } else {
    alert('Sản phẩm đã có trong giỏ hàng.');
  }

  // Nếu đang ở trang giỏ hàng, cập nhật ngay
  if (window.location.pathname.endsWith('cart.html')) {
    loadCartPage();
  }
}




// Thêm sản phẩm vào danh sách đã mua trong localStorage
function addToPurchasedProductsLocal(productId) {
  let purchasedProducts = getFromLocalStorage('purchasedProducts') || [];
  if (!purchasedProducts.includes(productId)) {
    purchasedProducts.push(productId);
    saveToLocalStorage('purchasedProducts', purchasedProducts);
  }
}

// Lưu lịch sử tương tác
function saveInteraction(type, data) {
  if (!currentUser) return;

  let userInteractions = getFromLocalStorage('userInteractions') || {};
  userInteractions[type] = userInteractions[type] || [];
  userInteractions[type].push(data);

  saveToLocalStorage('userInteractions', userInteractions);
}

// Chuyển đến trang chủ
function goToHome() {
  window.location.href = 'index.html';
}

// Chuyển đến trang danh mục
function goToCategory(categoryName) {
  saveToLocalStorage('selectedCategory', categoryName);
  window.location.href = 'products.html';
}

// Chuyển đến trang giỏ hàng
function goToCart() {
  window.location.href = 'cart.html';
}

// Hiển thị sản phẩm theo danh mục
// async function loadCategoryPage() {
//   productsData = await loadJSON('products.json');
//   currentCategory = getFromLocalStorage('selectedCategory');

//   const categoryTitle = document.getElementById('category-title');
//   categoryTitle.textContent = currentCategory;

//   const category = productsData.categories.find(c => c.name === currentCategory);
//   if (category) {
//     displayProducts(category.products, 'category-products');
//   } else {
//     document.getElementById('category-products').innerHTML = '<p>Không tìm thấy danh mục.</p>';
//   }
// }
async function loadCategoryPage() {
  // Lấy danh mục đã chọn từ LocalStorage
  const selectedCategory = getFromLocalStorage('selectedCategory');
  if (!selectedCategory) {
    document.getElementById('category-products').innerHTML = '<p>Không tìm thấy danh mục.</p>';
    return;
  }

  // Tải dữ liệu sản phẩm
  productsData = await loadJSON('products.json');
  const category = productsData.categories.find(c => c.name === selectedCategory);

  if (category) {
    // Hiển thị tiêu đề danh mục
    document.getElementById('category-title').textContent = selectedCategory;

    // Hiển thị sản phẩm thuộc danh mục
    displayProducts(category.products, 'category-products');
  } else {
    document.getElementById('category-products').innerHTML = '<p>Không tìm thấy sản phẩm trong danh mục này.</p>';
  }
}


// Tìm kiếm sản phẩm trên trang chủ
function searchProducts() {
  const query = document.getElementById('search-input').value.trim().toLowerCase();
  if (!query) return;

  // Lưu lịch sử tìm kiếm
  saveInteraction('searches', query);

  const allProducts = productsData.categories.flatMap(c => c.products);
  const results = allProducts.filter(p =>
    p.name.toLowerCase().includes(query) || p.description.toLowerCase().includes(query)
  );

  displayProducts(results, 'featured-products');
}

// Tìm kiếm sản phẩm trong danh mục
function searchCategoryProducts() {
  const query = document.getElementById('search-input').value.trim().toLowerCase();
  if (!query) return;

  // Lưu lịch sử tìm kiếm
  saveInteraction('searches', query);

  const category = productsData.categories.find(c => c.name === currentCategory);
  if (category) {
    const results = category.products.filter(p =>
      p.name.toLowerCase().includes(query) || p.description.toLowerCase().includes(query)
    );
    displayProducts(results, 'category-products');
  }
}

// Hiển thị chi tiết sản phẩm
function loadProductDetail() {
  selectedProduct = getFromLocalStorage('selectedProduct');
  if (!selectedProduct) {
    alert('Không tìm thấy sản phẩm.');
    return;
  }

  document.getElementById('product-image').src = selectedProduct.image;
  document.getElementById('product-name').textContent = selectedProduct.name;
  document.getElementById('product-description').textContent = selectedProduct.description;
}

// Đăng xuất
function logout() {
  // Xóa thông tin người dùng khỏi LocalStorage
  localStorage.removeItem('currentUser');
  localStorage.removeItem('userInteractions');
  localStorage.removeItem('purchasedProducts');
  // Chuyển hướng về trang đăng nhập
  window.location.href = 'index.html';
}

// Khởi tạo trang
window.onload = function() {
  const currentPage = window.location.pathname;

  // Khôi phục `currentUser` từ LocalStorage
  currentUser = getFromLocalStorage('currentUser');

  if (currentPage.endsWith('index.html') || currentPage.endsWith('/')) {
    if (currentUser) {
      document.getElementById('login-section').classList.add('hidden');
      document.getElementById('home-content').classList.remove('hidden');
      loadHomePage();
    }
  } else if (currentPage.endsWith('cart.html')) {
    if (currentUser) {
      loadCartPage();
    } else {
      alert('Vui lòng đăng nhập để xem giỏ hàng.');
      window.location.href = 'index.html';
    }
  }

 
  if (window.location.pathname.endsWith('products.html')) {
    loadCategoryPage(); // Tải trang danh mục
  }

  if (currentUser) {
    loadHomePage(); // Tải giao diện trang chủ
    displayRecommendedProducts(); // Hiển thị sản phẩm gợi ý
  }
};


// Lấy giỏ hàng của tài khoản hiện tại
function getCartForUser(username) {
  const carts = getFromLocalStorage('userCarts') || {};
  return carts[username] || [];
}

// Lưu giỏ hàng cho tài khoản hiện tại
function saveCartForUser(username, cart) {
  const carts = getFromLocalStorage('userCarts') || {};
  carts[username] = cart;
  saveToLocalStorage('userCarts', carts);
}

// Thêm sản phẩm vào giỏ hàng
function addToCart(productId) {
  if (!currentUser) {
    alert('Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng.');
    return;
  }

  const username = currentUser.username;
  const cart = getCartForUser(username);

  // Thêm sản phẩm nếu chưa có trong giỏ hàng
  if (!cart.includes(productId)) {
    cart.push(productId);
    saveCartForUser(username, cart);
    alert('Sản phẩm đã được thêm vào giỏ hàng.');
  } else {
    alert('Sản phẩm đã có trong giỏ hàng.');
  }
}
// Tải trang giỏ hàng
async function loadCartPage() {
  // Kiểm tra người dùng hiện tại
  if (!currentUser) {
    alert('Vui lòng đăng nhập để xem giỏ hàng.');
    window.location.href = 'index.html';
    return;
  }

  // Lấy username và giỏ hàng từ localStorage
  const username = currentUser.username;
  const cart = getCartForUser(username); // Lấy danh sách sản phẩm từ giỏ hàng của người dùng hiện tại

  if (cart.length === 0) {
    document.getElementById('cart-products').innerHTML = '<p>Bạn chưa mua sản phẩm nào.</p>';
    return;
  }

  // Tải dữ liệu sản phẩm
  productsData = await loadJSON('products.json');

  // Lấy thông tin sản phẩm từ giỏ hàng
  const purchasedProducts = cart.map(productId => findProductById(productId));
  displayPurchasedProducts(purchasedProducts);
}


// Hiển thị danh sách sản phẩm đã mua
function displayPurchasedProducts(products) {
  const container = document.getElementById('cart-products');
  container.innerHTML = '';

  if (products.length === 0) {
    container.innerHTML = '<p>Bạn chưa mua sản phẩm nào.</p>';
    return;
  }

  products.forEach(product => {
    const productDiv = document.createElement('div');
    productDiv.className = 'product';
    productDiv.innerHTML = `
      <img src="${product.image}" alt="${product.name}">
      <h3>${product.name}</h3>
      <button onclick="viewProduct(${product.id})">Xem</button>
    `;
    container.appendChild(productDiv);
  });
}







//////////////gợi ý sản phẩm
function calculateProductPopularity() {
  const userCarts = getFromLocalStorage('userCarts') || {};
  const productPopularity = {};

  // Duyệt qua từng user và sản phẩm trong giỏ hàng
  Object.values(userCarts).forEach(cart => {
    cart.forEach(productId => {
      if (!productPopularity[productId]) {
        productPopularity[productId] = 0;
      }
      productPopularity[productId]++;
    });
  });

  return productPopularity; // Trả về đối tượng với sản phẩm và số lượng người mua
}
function getRecommendedProducts() {
  const productPopularity = calculateProductPopularity();

  // Lọc sản phẩm có từ 2 người mua trở lên
  const recommendedProductIds = Object.keys(productPopularity).filter(
    productId => productPopularity[productId] >= 2
  );

  // Lấy thông tin sản phẩm từ products.json dựa trên ID
  return recommendedProductIds.map(productId => findProductById(parseInt(productId)));
}


function displayRecommendedProducts() {
  if (!currentUser) {
    console.warn("Chưa đăng nhập, không thể gợi ý sản phẩm.");
    return;
  }

  const userCart = getCartForUser(currentUser.username);

  // Gợi ý dựa trên số lượng người mua
  const popularityRecommendations = getRecommendedProducts();

  // Gợi ý dựa trên TF-IDF và Cosine Similarity
  const keywordRecommendations = getContentBasedRecommendations(userCart, productsData, tfidfVectors);

  // Kết hợp các gợi ý (loại bỏ trùng lặp)
  const combinedRecommendations = [
    ...new Map([...popularityRecommendations, ...keywordRecommendations].map(item => [item.id, item])).values()
  ];

  if (combinedRecommendations.length === 0) {
    console.warn("Không có sản phẩm nào để gợi ý.");
    const container = document.getElementById('recommended-products');
    container.innerHTML = '<p>Không có sản phẩm nào để gợi ý.</p>';
    return;
  }

  // Hiển thị sản phẩm gợi ý
  displayProducts(combinedRecommendations, 'recommended-products');
}


console.log("User Carts:", getFromLocalStorage('userCarts'));
console.log("Product Popularity:", calculateProductPopularity());
console.log("Recommended Products:", getRecommendedProducts());


