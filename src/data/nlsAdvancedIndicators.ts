export type AdvancedNlsLevel = "TC1" | "TC2" | "NC1";

export type AdvancedNlsComponent = {
  component: string;
  levels: Record<AdvancedNlsLevel, Record<string, string>>;
};

const defineComponent = (
  component: string,
  TC1: Record<string, string>,
  TC2: Record<string, string>,
  NC1: Record<string, string>,
): AdvancedNlsComponent => ({ component, levels: { TC1, TC2, NC1 } });

// Dữ liệu được phiên âm từ Bảng mã NLS do người dùng cung cấp.
// Không bổ sung NC2 vì tài liệu nguồn chỉ quy định đến NC1.
export const ADVANCED_NLS_COMPONENTS: AdvancedNlsComponent[] = [
  defineComponent(
    "1.1",
    {
      a: "Giải thích được nhu cầu thông tin.",
      b: "Thực hiện được rõ ràng và theo quy trình các tìm kiếm để tìm dữ liệu, thông tin và nội dung trong môi trường số.",
      c: "Giải thích được cách truy cập và điều hướng các kết quả tìm kiếm.",
      d: "Giải thích được rõ ràng và theo quy trình chiến lược tìm kiếm.",
    },
    {
      a: "Minh họa được nhu cầu thông tin.",
      b: "Tổ chức được tìm kiếm dữ liệu, thông tin và nội dung trong môi trường số.",
      c: "Mô tả được cách truy cập những dữ liệu, thông tin và nội dung này cũng như điều hướng giữa chúng.",
      d: "Tổ chức được các chiến lược tìm kiếm.",
    },
    {
      a: "Đáp ứng được nhu cầu thông tin.",
      b: "Áp dụng được kỹ thuật tìm kiếm để lấy được dữ liệu, thông tin và nội dung trong môi trường số.",
      c: "Chỉ cho người khác cách truy cập những dữ liệu, thông tin và nội dung này cũng như điều hướng giữa chúng.",
      d: "Tự đề xuất được chiến lược tìm kiếm.",
    },
  ),
  defineComponent(
    "1.2",
    {
      a: "Thực hiện phân tích, so sánh, đánh giá được độ tin cậy và độ chính xác của các nguồn dữ liệu, thông tin và nội dung số đã được tổ chức rõ ràng.",
      b: "Thực hiện phân tích, diễn giải và đánh giá được dữ liệu, thông tin và nội dung số được xác định rõ ràng.",
    },
    {
      a: "Thực hiện phân tích, so sánh và đánh giá được các nguồn dữ liệu, thông tin và nội dung số.",
      b: "Thực hiện phân tích, diễn giải và đánh giá được dữ liệu, thông tin và nội dung số.",
    },
    {
      a: "Thực hiện đánh giá được độ tin cậy và độ tin cậy của các nguồn dữ liệu, thông tin và nội dung số.",
      b: "Tiến hành đánh giá được các dữ liệu, thông tin và nội dung số khác nhau.",
    },
  ),
  defineComponent(
    "1.3",
    {
      a: "Lựa chọn được dữ liệu, thông tin và nội dung để tổ chức, lưu trữ và truy xuất chúng một cách thường xuyên trong môi trường số.",
      b: "Sắp xếp chúng một cách trật tự trong một môi trường có cấu trúc.",
    },
    {
      a: "Sắp xếp được thông tin, dữ liệu, nội dung để dễ dàng lưu trữ và truy xuất.",
      b: "Tổ chức được thông tin, dữ liệu và nội dung trong một môi trường có cấu trúc.",
    },
    {
      a: "Thao tác được thông tin, dữ liệu và nội dung để tổ chức, lưu trữ và truy xuất dễ dàng hơn.",
      b: "Triển khai được việc tổ chức và sắp xếp dữ liệu, thông tin và nội dung trong môi trường có cấu trúc.",
    },
  ),
  defineComponent(
    "2.1",
    {
      a: "Thực hiện được các tương tác được xác định rõ ràng và thường xuyên với các công nghệ số.",
      b: "Lựa chọn được các phương tiện giao tiếp số phù hợp, được xác định rõ ràng cho phù hợp với bối cảnh nhất định.",
    },
    {
      a: "Lựa chọn được nhiều công nghệ số để tương tác.",
      b: "Lựa chọn được nhiều phương tiện truyền thông số cho phù hợp với bối cảnh nhất định.",
    },
    {
      a: "Sử dụng được nhiều công nghệ số để tương tác.",
      b: "Cho người khác thấy phương tiện giao tiếp số phù hợp nhất cho một bối cảnh cụ thể.",
    },
  ),
  defineComponent(
    "2.2",
    {
      a: "Lựa chọn các công nghệ số phù hợp được xác định rõ để trao đổi dữ liệu, thông tin và nội dung số.",
      b: "Giải thích cách thức hoạt động như một trung gian để chia sẻ thông tin và nội dung thông qua các công nghệ kỹ thuật số được xác định rõ ràng và thường xuyên.",
      c: "Minh họa rõ ràng và thường xuyên các phương pháp tham chiếu và ghi chú nguồn.",
    },
    {
      a: "Vận dụng được các công nghệ số phù hợp để chia sẻ dữ liệu, thông tin và nội dung số.",
      b: "Giải thích được cách đóng vai trò trung gian để chia sẻ thông tin và nội dung thông qua công nghệ số.",
      c: "Áp dụng được các phương pháp tham chiếu và ghi chú nguồn.",
    },
    {
      a: "Chia sẻ dữ liệu, thông tin và nội dung số thông qua nhiều công cụ số phù hợp.",
      b: "Hướng dẫn người khác cách đóng vai trò trung gian để chia sẻ thông tin và nội dung thông qua công nghệ số.",
      c: "Áp dụng được nhiều phương pháp tham chiếu và ghi nguồn khác nhau.",
    },
  ),
  defineComponent(
    "2.3",
    {
      a: "Lựa chọn được các dịch vụ số được xác định rõ ràng và phổ biến để tham gia vào xã hội.",
      b: "Xác định được các công nghệ số rõ ràng và thích hợp để tự mình trang bị và tham gia vào xã hội như một công dân.",
    },
    {
      a: "Lựa chọn được các dịch vụ số để tham gia vào xã hội.",
      b: "Thảo luận về các công nghệ số phù hợp để nâng cao năng lực của bản thân và tham gia vào xã hội với tư cách là một công dân.",
    },
    {
      a: "Đề xuất được các dịch vụ số khác nhau để tham gia vào xã hội.",
      b: "Sử dụng được các công nghệ số thích hợp để tự mình trang bị và tham gia vào xã hội như một công dân.",
    },
  ),
  defineComponent(
    "2.4",
    { a: "Lựa chọn được các công cụ và công nghệ số được xác định rõ ràng và thường xuyên cho các quá trình hợp tác." },
    { a: "Lựa chọn được các công cụ và công nghệ số cho các quá trình hợp tác." },
    { a: "Đề xuất được các công cụ và công nghệ số khác nhau cho các quá trình hợp tác." },
  ),
  defineComponent(
    "2.5",
    {
      a: "Làm rõ được các chuẩn mực hành vi thường xuyên và được xác định rõ ràng cũng như bí quyết khi sử dụng công nghệ số và tương tác trong môi trường số.",
      b: "Thể hiện được các chiến lược giao tiếp thường xuyên và xác định rõ ràng phương thức giao tiếp phù hợp trong môi trường số.",
      c: "Mô tả các khía cạnh đa dạng về văn hóa và thế hệ được xác định rõ ràng và thông thường cần xem xét trong môi trường số.",
    },
    {
      a: "Thảo luận về các chuẩn mực hành vi và cách sử dụng công nghệ số và tương tác trong môi trường số.",
      b: "Thảo luận các chiến lược giao tiếp phù hợp trong môi trường số.",
      c: "Thảo luận các khía cạnh đa dạng về văn hóa và thế hệ cần xem xét trong môi trường số.",
    },
    {
      a: "Áp dụng được các chuẩn mực hành vi và bí quyết khác nhau khi sử dụng công nghệ số và tương tác trong môi trường số.",
      b: "Áp dụng được các chiến lược giao tiếp khác nhau trong môi trường số một cách phù hợp.",
      c: "Áp dụng được các khía cạnh đa dạng về văn hóa và thế hệ khác nhau để xem xét trong môi trường số.",
    },
  ),
  defineComponent(
    "2.6",
    {
      a: "Phân biệt được một loạt các danh tính số thông thường và được xác định rõ ràng.",
      b: "Giải thích được những cách được xác định rõ ràng và thường xuyên để bảo vệ danh tiếng trực tuyến của bản thân.",
      c: "Mô tả dữ liệu được xác định rõ ràng mà bạn thường xuyên thu được thông qua các công cụ, môi trường hoặc dịch vụ số.",
    },
    {
      a: "Hiển thị được nhiều danh tính số cụ thể.",
      b: "Thảo luận những cách cụ thể để bảo vệ danh tiếng trực tuyến của bản thân.",
      c: "Thao tác dữ liệu cá nhân tạo ra thông qua các công cụ, môi trường hoặc dịch vụ số.",
    },
    {
      a: "Sử dụng được nhiều danh tính số khác nhau.",
      b: "Áp dụng được các cách khác nhau để bảo vệ danh tính trực tuyến của bản thân.",
      c: "Sử dụng được dữ liệu tạo ra thông qua công cụ, môi trường và một số dịch vụ số.",
    },
  ),
  defineComponent(
    "3.1",
    {
      a: "Chỉ ra được cách tạo và chỉnh sửa nội dung có khái niệm cụ thể và mang tính phổ thông bằng những định dạng rõ ràng, phổ biến.",
      b: "Thể hiện được bản thân thông qua việc tạo ra các nội dung số thông thường và được xác định rõ ràng.",
    },
    {
      a: "Chỉ ra được cách tạo và chỉnh sửa nội dung ở các định dạng khác nhau.",
      b: "Thể hiện được bản thân thông qua việc tạo ra các nội dung số.",
    },
    {
      a: "Áp dụng được các cách tạo và chỉnh sửa nội dung ở các định dạng khác nhau.",
      b: "Chỉ ra được những cách thể hiện bản thân thông qua việc tạo ra các nội dung số.",
    },
  ),
  defineComponent(
    "3.2",
    { a: "Giải thích được các cách sửa đổi, tinh chỉnh, cải thiện và tích hợp các mục nội dung và thông tin mới được xác định rõ ràng để tạo ra những nội dung và thông tin mới và độc đáo." },
    { a: "Thảo luận các cách sửa đổi, tinh chỉnh, cải thiện và tích hợp nội dung và thông tin mới để tạo ra những nội dung và thông tin mới và độc đáo." },
    { a: "Làm việc với các mục nội dung và thông tin mới khác nhau, sửa đổi, tinh chỉnh, cải thiện và tích hợp chúng để tạo ra những mục mới và độc đáo." },
  ),
  defineComponent(
    "3.3",
    { a: "Chỉ ra được các quy tắc thông thường và được xác định rõ ràng về bản quyền và giấy phép áp dụng cho dữ liệu, thông tin và nội dung số." },
    { a: "Thảo luận các quy tắc về bản quyền và giấy phép áp dụng cho thông tin và nội dung số." },
    { a: "Áp dụng được các quy định khác nhau về bản quyền và giấy phép cho dữ liệu, thông tin và nội dung số." },
  ),
  defineComponent(
    "3.4",
    { a: "Liệt kê được các hướng dẫn thông thường và được xác định rõ ràng cho một hệ thống máy tính để giải quyết các vấn đề thường ngày hoặc thực hiện các tác vụ thường ngày." },
    { a: "Liệt kê được các hướng dẫn cho một hệ thống máy tính để giải quyết một vấn đề nhất định hoặc thực hiện một nhiệm vụ cụ thể." },
    { a: "Tự thao tác được bằng các hướng dẫn dành cho hệ thống máy tính để giải quyết một vấn đề khác hoặc thực hiện các nhiệm vụ khác nhau." },
  ),
  defineComponent(
    "4.1",
    {
      a: "Chỉ ra được những cách thức cơ bản và phổ biến để bảo vệ thiết bị và nội dung số.",
      b: "Phân biệt được những rủi ro và mối đe dọa cơ bản và phổ biến trong môi trường số.",
      c: "Chọn lựa được các biện pháp an toàn và bảo mật rõ ràng và thường xuyên.",
      d: "Chỉ ra được những cách thức cơ bản và phổ biến để quan tâm đến mức độ tin cậy và quyền riêng tư.",
    },
    {
      a: "Thiết lập được những cách thức bảo vệ thiết bị và nội dung số.",
      b: "Phân biệt được rủi ro và mối đe dọa trong môi trường số.",
      c: "Chọn lựa được các biện pháp an toàn và bảo mật.",
      d: "Giải thích được các cách thức để quan tâm đến mức độ tin cậy và quyền riêng tư.",
    },
    {
      a: "Áp dụng được các cách khác nhau để bảo vệ thiết bị và nội dung số.",
      b: "Nhận thức được sự đa dạng của các rủi ro và đe dọa trong môi trường số.",
      c: "Áp dụng được các biện pháp an toàn và bảo mật.",
      d: "Sử dụng được các cách thức khác nhau để quan tâm đến mức độ tin cậy và quyền riêng tư.",
    },
  ),
  defineComponent(
    "4.2",
    {
      a: "Giải thích được các cách thức cơ bản và phổ biến để bảo vệ dữ liệu cá nhân và quyền riêng tư trong môi trường số.",
      b: "Giải thích được các cách thức cơ bản và phổ biến để sử dụng và chia sẻ thông tin định danh cá nhân một cách an toàn.",
      c: "Chỉ ra được các tuyên bố cơ bản và phổ biến trong chính sách quyền riêng tư về cách sử dụng dữ liệu cá nhân trong các dịch vụ số.",
    },
    {
      a: "Thảo luận về cách bảo vệ dữ liệu cá nhân và quyền riêng tư trong môi trường số.",
      b: "Thảo luận về cách sử dụng và chia sẻ thông tin định danh cá nhân một cách an toàn.",
      c: "Chỉ ra được các tuyên bố trong chính sách quyền riêng tư về cách sử dụng dữ liệu cá nhân trong các dịch vụ số.",
    },
    {
      a: "Áp dụng được các cách thức khác nhau để bảo vệ dữ liệu cá nhân và quyền riêng tư trong môi trường số.",
      b: "Áp dụng được các cách thức đặc thù để chia sẻ dữ liệu cá nhân một cách an toàn.",
      c: "Giải thích được các tuyên bố trong chính sách quyền riêng tư về cách sử dụng dữ liệu cá nhân trong các dịch vụ số.",
    },
  ),
  defineComponent(
    "4.3",
    {
      a: "Giải thích được những cách thức cơ bản và phổ biến để tránh rủi ro và đe dọa đối với sức khỏe thể chất và tinh thần khi sử dụng công nghệ số.",
      b: "Lựa chọn được những cách thức cơ bản và phổ biến để bảo vệ bản thân khỏi nguy cơ trong môi trường số.",
      c: "Chỉ ra được những công nghệ số cơ bản và phổ biến giúp tăng cường thịnh vượng xã hội và sự hòa hợp trong xã hội.",
    },
    {
      a: "Giải thích được những cách thức để tránh những sự đe dọa liên quan đến việc sử dụng công nghệ số đối với sức khỏe thể chất và tinh thần.",
      b: "Lựa chọn được cách thức bảo vệ bản thân và người khác khỏi nguy cơ trong môi trường số.",
      c: "Thảo luận về những công nghệ số giúp tăng cường thịnh vượng xã hội và sự hòa hợp trong xã hội.",
    },
    {
      a: "Trình bày được các cách thức khác nhau để tránh rủi ro và đe dọa đến sức khỏe thể chất và tinh thần khi sử dụng công nghệ số.",
      b: "Áp dụng được các cách thức khác nhau để bảo vệ bản thân và người khác khỏi nguy cơ trong môi trường số.",
      c: "Trình bày được các công nghệ số khác nhau giúp tăng cường thịnh vượng xã hội và sự hòa hợp trong xã hội.",
    },
  ),
  defineComponent(
    "4.4",
    { a: "Chỉ ra được những tác động cơ bản và phổ biến của công nghệ số và việc sử dụng công nghệ số đối với môi trường." },
    { a: "Thảo luận về các cách thức bảo vệ môi trường khỏi tác động của công nghệ số và việc sử dụng công nghệ số." },
    { a: "Trình bày được các cách thức khác nhau để bảo vệ môi trường khỏi tác động của công nghệ số và việc sử dụng công nghệ số." },
  ),
  defineComponent(
    "5.1",
    {
      a: "Chỉ ra được các vấn đề kỹ thuật thông thường và được xác định rõ ràng khi vận hành thiết bị và sử dụng môi trường số.",
      b: "Chọn được các giải pháp được xác định rõ ràng và thông thường cho chúng.",
    },
    {
      a: "Phân biệt được các vấn đề kỹ thuật khi vận hành thiết bị và sử dụng môi trường số.",
      b: "Chọn được giải pháp cho chúng.",
    },
    {
      a: "Đánh giá được các vấn đề kỹ thuật khi sử dụng môi trường số và vận hành các thiết bị số.",
      b: "Áp dụng được các giải pháp khác nhau cho chúng.",
    },
  ),
  defineComponent(
    "5.2",
    {
      a: "Chỉ ra được những nhu cầu được xác định rõ ràng và thường xuyên.",
      b: "Chọn được các công cụ số thông thường và được xác định rõ ràng cũng như các giải pháp công nghệ có thể có để giải quyết những nhu cầu đó.",
      c: "Chọn được những cách thông thường và được xác định rõ ràng để điều chỉnh và tùy chỉnh môi trường số theo nhu cầu cá nhân.",
    },
    {
      a: "Giải thích nhu cầu cá nhân.",
      b: "Lựa chọn được các công cụ số và các giải pháp công nghệ có thể có để giải quyết những nhu cầu đó.",
      c: "Chọn được cách điều chỉnh và tùy chỉnh môi trường số theo nhu cầu cá nhân.",
    },
    {
      a: "Đánh giá được nhu cầu cá nhân.",
      b: "Áp dụng được các công cụ số khác nhau và các giải pháp công nghệ có thể có để giải quyết những nhu cầu đó.",
      c: "Sử dụng được các cách khác nhau để điều chỉnh và tùy chỉnh môi trường số theo nhu cầu cá nhân.",
    },
  ),
  defineComponent(
    "5.3",
    {
      a: "Chọn được các công cụ và công nghệ số có thể được sử dụng để tạo ra kiến thức rõ ràng cũng như các quy trình và sản phẩm đổi mới được xác định rõ ràng.",
      b: "Gắn kết được cá nhân và tập thể vào một số quá trình xử lý nhận thức để hiểu và giải quyết các vấn đề mang tính khái niệm và tình huống có vấn đề thông thường và được xác định rõ ràng trong môi trường số.",
    },
    {
      a: "Phân biệt được các công cụ và công nghệ số có thể được sử dụng để tạo ra kiến thức và đổi mới quy trình và sản phẩm.",
      b: "Gắn kết được cá nhân và tập thể vào quá trình xử lý nhận thức để hiểu và giải quyết các vấn đề khái niệm và tình huống có vấn đề trong môi trường số.",
    },
    {
      a: "Áp dụng được các công cụ và công nghệ số khác nhau để tạo ra kiến thức cũng như các quy trình và sản phẩm đổi mới.",
      b: "Áp dụng xử lý nhận thức của cá nhân và tập thể để giải quyết các vấn đề khái niệm và tình huống có vấn đề khác nhau trong môi trường số.",
    },
  ),
  defineComponent(
    "5.4",
    {
      a: "Giải thích được NLS của bản thân cần được cải thiện hoặc cập nhật ở đâu.",
      b: "Chỉ ra được nơi để tìm kiếm các cơ hội được xác định rõ ràng để phát triển bản thân và cập nhật sự phát triển công nghệ số.",
    },
    {
      a: "Thảo luận về lĩnh vực NLS của bản thân cần được cải thiện hoặc cập nhật.",
      b: "Chỉ ra được cách hỗ trợ người khác phát triển NLS của họ.",
      c: "Chỉ ra được nơi để tìm kiếm cơ hội phát triển bản thân và cập nhật sự phát triển công nghệ số.",
    },
    {
      a: "Chứng minh được NLS của tôi cần được cải thiện hoặc cập nhật ở đâu.",
      b: "Minh họa được những cách khác nhau để hỗ trợ người khác phát triển NLS của họ.",
      c: "Đề xuất được các cơ hội khác nhau để phát triển bản thân và cập nhật sự phát triển công nghệ số.",
    },
  ),
  defineComponent(
    "6.1",
    {
      a: "Giải thích được nguyên tắc hoạt động cơ bản của AI.",
      b: "Diễn giải được các thuật ngữ và khái niệm liên quan đến AI.",
    },
    {
      a: "Áp dụng được các nguyên tắc cơ bản của AI để giải quyết vấn đề đơn giản.",
      b: "Thực hiện được các thao tác cơ bản trên các công cụ AI.",
    },
    {
      a: "Phân tích được cách AI hoạt động trong các ứng dụng cụ thể.",
      b: "So sánh được các hệ thống AI khác nhau và cách chúng xử lý dữ liệu.",
    },
  ),
  defineComponent(
    "6.2",
    {
      a: "Sử dụng được các công cụ AI trong công việc và học tập hàng ngày.",
      b: "Thực hành được các kỹ năng sử dụng AI thông qua các bài tập và dự án nhỏ.",
      c: "Xem xét các khía cạnh đạo đức khi sử dụng AI, bảo đảm không vi phạm quyền riêng tư và bảo mật dữ liệu.",
    },
    {
      a: "Tối ưu hóa việc sử dụng các công cụ AI để đạt hiệu quả cao hơn.",
      b: "Quản lý được việc triển khai các công cụ AI trong các dự án nhỏ.",
      c: "Bảo vệ được dữ liệu cá nhân và tuân thủ các quy định pháp luật về bảo mật thông tin khi sử dụng AI.",
    },
    {
      a: "Phát triển được các ứng dụng AI tùy chỉnh để giải quyết các vấn đề cụ thể.",
      b: "Điều chỉnh được các hệ thống AI để phù hợp với nhu cầu cụ thể.",
      c: "Đánh giá và giảm thiểu được các rủi ro đạo đức và pháp lý liên quan đến việc sử dụng AI.",
    },
  ),
  defineComponent(
    "6.3",
    {
      a: "Giải thích được cách thức hoạt động của các hệ thống AI đơn giản.",
      b: "Tóm tắt được các đặc điểm và ứng dụng của hệ thống AI.",
    },
    {
      a: "Phân tích được hiệu quả của hệ thống AI trong việc giải quyết các vấn đề cụ thể.",
      b: "So sánh được hiệu suất của các hệ thống AI khác nhau.",
    },
    {
      a: "Đánh giá được độ chính xác và tin cậy của các hệ thống AI.",
      b: "Xem xét được các kết quả và đưa ra nhận xét về hiệu quả của hệ thống AI.",
    },
  ),
];
