function(scd_qwen_target)
    add_executable(scd-qwen "${SCD_QWEN_MAIN}")
    target_link_libraries(scd-qwen PRIVATE qwen-core)
    link_ggml_backends(scd-qwen)
endfunction()

cmake_language(DEFER CALL scd_qwen_target)
